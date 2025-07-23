Of course. Here is the complete, modified code that implements the dual-mode authentication logic.

The application will now:

1.  Initialize **static, read-only clients** at startup for a default dashboard view.
2.  Upon user login, create a session and use the provided credentials to generate **user-specific tokens**.
3.  For subsequent requests from a logged-in user, the aspect will use the **session tokens**. For unauthenticated requests, it will fall back to the **static clients**.

-----

### \#\# 1. Configure Static Credentials

Add the static username and password to your `application.properties` file. These will be used for the initial, read-only dashboard state.

**`src/main/resources/application.properties`**

```properties
# ... (H2, Spring Session, and other properties remain the same)

# Your OpenShift properties
openshift.gl.api.server=...
openshift.sl.api.server=...
openshift.gl.auth.server=...
openshift.sl.auth.server=...

# STATIC credentials for initial read-only dashboard view
openshift.static.username=your-static-readonly-user
openshift.static.password=your-static-readonly-password
```

-----

### \#\# 2. Update the Token Provider

The `TokenProvider` will now be used to fetch tokens for both the static user at startup and dynamic users at login.

**`com/barclays/iportalmonitoring/service/impl/TokenProviderImpl.java`**

```java
import java.util.Base64;
// ... other imports

@Component
public class TokenProviderImpl implements TokenProvider {

    private final String glAuthServerUrl;
    private final String slAuthServerUrl;

    // Inject properties
    @Autowired
    public TokenProviderImpl(@Value("${openshift.gl.auth.server}") String glAuthServerUrl,
                             @Value("${openshift.sl.auth.server}") String slAuthServerUrl) {
        this.glAuthServerUrl = glAuthServerUrl;
        this.slAuthServerUrl = slAuthServerUrl;
    }
    
    /**
     * Public method to fetch a token for a specific user during login.
     */
    public String fetchTokenForUser(String cluster, String username, String password) {
        String clusterAuthUrl = "gl".equalsIgnoreCase(cluster) ? this.glAuthServerUrl : this.slAuthServerUrl;
        return fetchOAuthToken(clusterAuthUrl, username, password);
    }
    
    /**
     * Generic, private method to fetch any OAuth token.
     */
    private String fetchOAuthToken(String clusterURL, String username, String password) {
        String authToken = "";
        try {
            String credentials = username + ":" + password;
            String encodedCredentials = Base64.getEncoder().encodeToString(credentials.getBytes());

            URL url = new URL(clusterURL + "/oauth/authorize?response_type=token&client_id=openshift-challenging-client");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Authorization", "Basic " + encodedCredentials);
            connection.setInstanceFollowRedirects(false);

            int responseCode = connection.getResponseCode();

            if (responseCode == HttpURLConnection.HTTP_MOVED_TEMP) {
                String location = connection.getHeaderField("Location");
                authToken = location.split("#")[1].split("&")[0].split("=")[1];
            } else {
                throw new RuntimeException("Failed to fetch OpenShift OAuth token. Response Code: " + responseCode);
            }
        } catch (Exception e) {
            // Proper logging should be here
            throw new RuntimeException("Error fetching token for user " + username, e);
        }
        return authToken;
    }
}
```

-----

### \#\# 3. Refactor the OpenShift Service

This service will now initialize and hold the **static clients** and manage the `ThreadLocal` for the active client of any given request.

**`com/barclays/iportalmonitoring/service/impl/OpenShiftServiceImpl.java`**

```java
import io.fabric8.openshift.client.OpenShiftClient;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Service;

@Service
public class OpenShiftServiceImpl implements OpenShiftService {

    private static final Logger log = LoggerFactory.getLogger(OpenShiftServiceImpl.class);

    // Injected dependencies for initialization
    private final ApplicationContext applicationContext;
    private final TokenProvider tokenProvider;
    private final String staticUsername;
    private final String staticPassword;

    // Static clients initialized at startup
    private OpenShiftClient staticClientGL;
    private OpenShiftClient staticClientSL;

    // ThreadLocal holds the client (either static or user-specific) for the current request
    private final ThreadLocal<OpenShiftClient> activeClient = new ThreadLocal<>();

    @Autowired
    public OpenShiftServiceImpl(ApplicationContext applicationContext, TokenProvider tokenProvider,
                                @Value("${openshift.static.username}") String staticUsername,
                                @Value("${openshift.static.password}") String staticPassword) {
        this.applicationContext = applicationContext;
        this.tokenProvider = tokenProvider;
        this.staticUsername = staticUsername;
        this.staticPassword = staticPassword;
    }

    @PostConstruct
    public void initializeStaticClients() {
        log.info("Initializing static OpenShift clients for read-only access...");
        try {
            String tokenGL = tokenProvider.fetchTokenForUser("gl", staticUsername, staticPassword);
            this.staticClientGL = applicationContext.getBean(OpenShiftClient.class, "gl", tokenGL);

            String tokenSL = tokenProvider.fetchTokenForUser("sl", staticUsername, staticPassword);
            this.staticClientSL = applicationContext.getBean(OpenShiftClient.class, "sl", tokenSL);

            log.info("Static OpenShift clients initialized successfully.");
        } catch (Exception e) {
            log.error("FATAL: Could not initialize static OpenShift clients! Dashboard may be non-functional.", e);
        }
    }

    @Override
    public OpenShiftClient getActiveClient() {
        OpenShiftClient client = activeClient.get();
        if (client == null) {
            throw new IllegalStateException("No active OpenShift client is set for this request.");
        }
        return client;
    }

    public void setActiveClient(OpenShiftClient client) {
        activeClient.set(client);
    }
    
    public void setStaticClientForRequest(String clusterIdentifier) {
        if ("gl".equalsIgnoreCase(clusterIdentifier)) {
            activeClient.set(staticClientGL);
        } else if ("sl".equalsIgnoreCase(clusterIdentifier)) {
            activeClient.set(staticClientSL);
        } else {
            throw new IllegalArgumentException("Unknown cluster identifier for static client: " + clusterIdentifier);
        }
    }

    public void clearActiveClient() {
        activeClient.remove();
    }
}
```

*Note: Add `setStaticClientForRequest` to your `OpenShiftService` interface if it exists.*

-----

### \#\# 4. Update the AOP Aspect (Core Logic)

The aspect is the orchestrator. It checks for a user session. If a session exists, it creates a user-specific client. If not, it falls back to a static client.

**`com/barclays/iportalmonitoring/aspect/OpenShiftClientAspect.java`**

```java
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class OpenShiftClientAspect {

    private final OpenShiftServiceImpl openShiftService;
    private final ApplicationContext applicationContext;
    private final HttpServletRequest request;

    @Autowired
    public OpenShiftClientAspect(OpenShiftServiceImpl openShiftService, ApplicationContext applicationContext, HttpServletRequest request) {
        this.openShiftService = openShiftService;
        this.applicationContext = applicationContext;
        this.request = request;
    }

    @Around("@annotation(com.barclays.iportalmonitoring.annotation.UseOpenShiftClient)")
    public Object handleClientAspect(ProceedingJoinPoint joinPoint) throws Throwable {
        String cluster = findClusterIdentifier(joinPoint);
        HttpSession session = request.getSession(false); // false = don't create a new session

        String tokenKey = cluster + "_token";
        
        // Check if a user session exists and has the required token
        if (session != null && session.getAttribute(tokenKey) != null) {
            // --- USER-SPECIFIC CLIENT FLOW ---
            String token = (String) session.getAttribute(tokenKey);
            // The OpenShiftClient bean MUST be @Scope("prototype")
            OpenShiftClient userClient = applicationContext.getBean(OpenShiftClient.class, cluster, token);
            openShiftService.setActiveClient(userClient);
            
        } else {
            // --- STATIC CLIENT FALLBACK FLOW ---
            openShiftService.setStaticClientForRequest(cluster);
        }

        try {
            return joinPoint.proceed();
        } finally {
            // IMPORTANT: Always clear the ThreadLocal after the request is complete
            openShiftService.clearActiveClient();
        }
    }

    // Your existing private findClusterIdentifier method
    private String findClusterIdentifier(ProceedingJoinPoint joinPoint) { ... }
}
```

-----

### \#\# 5. Controller and Security

Your `AuthController` for logging in remains unchanged, as its job is simply to populate the session. The auditing aspect also requires no changes.

#### **Login Controller (No Changes)**

The `AuthController` you had before is perfect. When a user calls `/api/auth/login`, it will create the session attributes (`username`, `gl_token`, `sl_token`) that the `OpenShiftClientAspect` looks for.

#### **Security Configuration**

Ensure your security configuration allows unauthenticated access to the endpoints that should work in the read-only mode.

**`com/barclays/iportalmonitoring/config/SecurityConfig.java`**

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // Disable CSRF for stateless APIs if appropriate
            .authorizeHttpRequests(authz -> authz
                // Allow login/logout endpoints for everyone
                .requestMatchers("/api/auth/login", "/api/auth/logout").permitAll()
                // Allow unauthenticated access to H2 console
                .requestMatchers("/h2-console/**").permitAll()
                // Allow read-only dashboard endpoints for everyone (they will use the static client)
                .requestMatchers(HttpMethod.GET, "/api/pods/**", "/api/services/**").permitAll()
                // Require authentication for all other requests (e.g., POST, DELETE)
                .anyRequest().authenticated()
            )
            // This allows the h2-console to be rendered in a frame
            .headers(headers -> headers.frameOptions(frameOptions -> frameOptions.sameOrigin()));
            
        return http.build();
    }
}
```

This configuration secures your application while allowing the dual-mode functionality you requested.


    Of course. Here is the updated code that re-integrates your token refresh and retry logic into the new dual-mode system.

This implementation correctly distinguishes between an expired **user session token** (which requires re-login) and an expired **static client token** (which can be refreshed automatically).

-----

### \#\# 1. Update the OpenShift Service

First, we'll modify the `OpenShiftServiceImpl` to make the static client initialization method `synchronized` and reusable. This ensures that if multiple requests detect the expired static token simultaneously, they won't all try to re-initialize it at once.

**`com/barclays/iportalmonitoring/service/impl/OpenShiftServiceImpl.java`**

```java
// ... other imports
import jakarta.annotation.PostConstruct;

@Service
public class OpenShiftServiceImpl implements OpenShiftService {

    // ... all existing fields (log, applicationContext, tokenProvider, etc.) remain the same

    // The constructor remains the same
    @Autowired
    public OpenShiftServiceImpl(...) { ... }

    /**
     * This method runs once at startup to perform the initial client setup.
     */
    @PostConstruct
    public void initialSetup() {
        reinitializeStaticClients();
    }

    /**
     * Re-initializes the static, read-only clients. This method is synchronized
     * to prevent race conditions if multiple threads detect an expired token.
     * It's now the single source for creating/refreshing static clients.
     */
    public synchronized void reinitializeStaticClients() {
        log.info("Initializing/Refreshing static OpenShift clients...");
        try {
            String tokenGL = tokenProvider.fetchTokenForUser("gl", staticUsername, staticPassword);
            this.staticClientGL = applicationContext.getBean(OpenShiftClient.class, "gl", tokenGL);

            String tokenSL = tokenProvider.fetchTokenForUser("sl", staticUsername, staticPassword);
            this.staticClientSL = applicationContext.getBean(OpenShiftClient.class, "sl", tokenSL);

            log.info("Static OpenShift clients initialized/refreshed successfully.");
        } catch (Exception e) {
            log.error("FATAL: Could not initialize static OpenShift clients!", e);
        }
    }

    // ... all other methods (getActiveClient, setActiveClient, etc.) remain the same
}
```

-----

### \#\# 2. Update the AOP Aspect with Refresh Logic

This is the core of the solution. The aspect's `handleClientAspect` method will now contain the `try-catch` block to handle `KubernetesClientException`, detect a `401` error, and then decide whether to refresh the static client or invalidate the user's session.

**`com/barclays/iportalmonitoring/aspect/OpenShiftClientAspect.java`**

```java
import io.fabric8.kubernetes.client.KubernetesClientException;
// ... all other imports

@Aspect
@Component
public class OpenShiftClientAspect {

    private static final Logger log = LoggerFactory.getLogger(OpenShiftClientAspect.class);

    // ... constructor and fields remain the same

    @Around("@annotation(com.barclays.iportalmonitoring.annotation.UseOpenShiftClient)")
    public Object handleClientAspect(ProceedingJoinPoint joinPoint) throws Throwable {
        String cluster = findClusterIdentifier(joinPoint);
        
        // Determine if we are in a user session context before the try block
        HttpSession session = request.getSession(false);
        String tokenKey = cluster + "_token";
        boolean isUserSession = (session != null && session.getAttribute(tokenKey) != null);

        // Set the appropriate client (user or static)
        setupClient(cluster, session, isUserSession);

        try {
            // Proceed with the original method execution
            return joinPoint.proceed();

        } catch (KubernetesClientException e) {
            // Check if the token expired
            if (e.getCode() == 401) { 
                if (isUserSession) {
                    // --- USER TOKEN EXPIRED ---
                    // Cannot refresh without credentials. Invalidate the session to force re-login.
                    log.warn("User session token for cluster '{}' has expired. Invalidating session.", cluster);
                    session.invalidate();
                    // Re-throw the exception to send a 401 to the client.
                    throw e; 

                } else {
                    // --- STATIC TOKEN EXPIRED ---
                    // We have the static credentials, so we can refresh the clients and retry.
                    log.info("Static client token for cluster '{}' expired. Re-initializing and retrying.", cluster);
                    
                    // 1. Re-initialize the static clients
                    openShiftService.reinitializeStaticClients();
                    
                    // 2. Re-setup the ThreadLocal with the NEW static client for the retry
                    setupClient(cluster, null, false); // call setup again in static mode

                    // 3. Retry the operation
                    log.info("Retrying original operation...");
                    return joinPoint.proceed();
                }
            }
            // For any other Kubernetes exception, just re-throw it
            throw e;
        } finally {
            // IMPORTANT: Always clear the ThreadLocal
            openShiftService.clearActiveClient();
        }
    }

    /**
     * Helper method to set up the client in the ThreadLocal context.
     */
    private void setupClient(String cluster, HttpSession session, boolean isUserSession) {
        if (isUserSession) {
            String tokenKey = cluster + "_token";
            String token = (String) session.getAttribute(tokenKey);
            OpenShiftClient userClient = applicationContext.getBean(OpenShiftClient.class, cluster, token);
            openShiftService.setActiveClient(userClient);
        } else {
            openShiftService.setStaticClientForRequest(cluster);
        }
    }

    // Your private findClusterIdentifier method remains the same.
    private String findClusterIdentifier(ProceedingJoinPoint joinPoint) { ... }
}
```

### Summary of Changes & How It Works

1.  **Centralized Refresh**: The `OpenShiftServiceImpl` now has a `synchronized reinitializeStaticClients()` method. This is the single, thread-safe way to refresh the application's default clients.

2.  **Intelligent Exception Handling**: The `OpenShiftClientAspect` is now the central point for handling token expiry.

3.  **User Session Flow**:

      * An API call is made by a logged-in user.
      * The aspect sets up a client using the session token.
      * The call to OpenShift fails with a `401`.
      * The `catch` block executes, sees it's a user session (`isUserSession` is true), invalidates the session, and throws the exception. Your frontend should catch this `401 Unauthorized` response and redirect the user to the login page.

4.  **Static Client Flow**:

      * An API call is made by an unauthenticated user.
      * The aspect sets up a static client.
      * The call to OpenShift fails with a `401`.
      * The `catch` block executes, sees it's a static client (`isUserSession` is false), and calls `reinitializeStaticClients()`.
      * It then sets the **newly created** static client for the current request and calls `joinPoint.proceed()` again, seamlessly retrying the operation. The end-user never knows the token was refreshed.
