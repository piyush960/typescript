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
