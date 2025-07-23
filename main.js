Of course. Based on your existing code and requirements, here’s a comprehensive guide to implementing a secure login flow with session management backed by an H2 database and AOP-based auditing.

This solution integrates your multi-cluster OpenShift token logic directly into the user session, creating a dedicated OpenShift client for each user request.

-----

### \#\# 1. Add Dependencies

First, ensure your `pom.xml` includes the necessary dependencies for Spring Web, Security, Session JDBC, Data JPA, and H2.

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>

    <dependency>
        <groupId>org.springframework.session</groupId>
        <artifactId>spring-session-jdbc</artifactId>
    </dependency>

    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <scope>runtime</scope>
    </dependency>

    </dependencies>
```

-----

### \#\# 2. Configure Session & Database

Configure your `application.properties` to enable Spring Session with a JDBC store and set up the H2 database. Spring Session will automatically create the required tables (`SPRING_SESSION`, `SPRING_SESSION_ATTRIBUTES`) on startup.

**`src/main/resources/application.properties`**

```properties
# Spring Session JDBC Configuration
spring.session.store-type=jdbc
spring.session.jdbc.initialize-schema=always
# Optional: Set a session timeout (e.g., 30 minutes)
server.servlet.session.timeout=30m

# H2 Database Configuration
spring.h2.console.enabled=true
spring.h2.console.path=/h2-console
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driverClassName=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=password
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=update

# Your existing OpenShift properties
openshift.gl.api.server=...
openshift.sl.api.server=...
openshift.gl.auth.server=...
openshift.sl.auth.server=...
# REMOVE the pre-configured username/password if they are for a service account
# openshift.username=...
# openshift.password=...
```

-----

### \#\# 3. Implement the Login Flow

The login process will involve a controller to receive credentials, an updated `TokenProvider` to fetch tokens using those credentials, and storing the tokens in the session.

#### **Step 1: Create Login DTO**

Create a simple class to map the incoming JSON request body.

**`com/barclays/iportalmonitoring/model/LoginRequest.java`**

```java
public class LoginRequest {
    private String username;
    private String password;

    // Getters and Setters
}
```

#### **Step 2: Update TokenProvider**

Modify your `TokenProviderImpl` to handle dynamic user credentials instead of pre-configured ones.

**`com/barclays/iportalmonitoring/service/impl/TokenProviderImpl.java`**

```java
import java.util.Base64;
// ... other imports

@Component
public class TokenProviderImpl implements TokenProvider {
    // ... existing fields (glAuthServerUrl, slAuthServerUrl, etc.)

    // Keep your existing constructor and fetchOAuthTokenForGL/SL methods
    // They can be used for other service-to-service communications if needed

    /**
     * Fetches an OAuth token for a specific user.
     * @param clusterURL The OAuth server URL.
     * @param username The user's username.
     * @param password The user's password.
     * @return The OAuth token.
     */
    public String fetchTokenForUser(String clusterURL, String username, String password) {
        String authToken = "";
        try {
            // Encode user credentials for Basic Authentication
            String credentials = username + ":" + password;
            String encodedCredentials = Base64.getEncoder().encodeToString(credentials.getBytes());

            URL url = new URL(clusterURL + "/oauth/authorize?response_type=token&client_id=openshift-challenging-client");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Authorization", "Basic " + encodedCredentials);
            connection.setInstanceFollowRedirects(false); // Important to handle the redirect manually

            int responseCode = connection.getResponseCode();

            if (responseCode == HttpURLConnection.HTTP_MOVED_TEMP) {
                String location = connection.getHeaderField("Location");
                // Extract token from the redirect URL's fragment
                authToken = location.split("#")[1].split("&")[0].split("=")[1];
            } else {
                // Handle failed authentication appropriately
                throw new RuntimeException("Failed to fetch OpenShift OAuth token. Response Code: " + responseCode);
            }
        } catch (Exception e) {
            // Log the exception
            throw new RuntimeException("Error fetching user token", e);
        }
        return authToken;
    }

    // Your old private fetchOAuthToken can be removed or kept for other purposes
}
```

#### **Step 3: Create Login Controller**

This controller handles the `/login` endpoint. On successful authentication, it populates the session.

**`com/barclays/iportalmonitoring/controller/AuthController.java`**

```java
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpSession;
// ... other imports

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final TokenProvider tokenProvider;
    private final String glAuthServerUrl;
    private final String slAuthServerUrl;

    @Autowired
    public AuthController(TokenProvider tokenProvider,
                          @Value("${openshift.gl.auth.server}") String glAuthServerUrl,
                          @Value("${openshift.sl.auth.server}") String slAuthServerUrl) {
        this.tokenProvider = tokenProvider;
        this.glAuthServerUrl = glAuthServerUrl;
        this.slAuthServerUrl = slAuthServerUrl;
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody LoginRequest loginRequest, HttpSession session) {
        try {
            // Fetch tokens for both clusters using the user's credentials
            String glToken = tokenProvider.fetchTokenForUser(glAuthServerUrl, loginRequest.getUsername(), loginRequest.getPassword());
            String slToken = tokenProvider.fetchTokenForUser(slAuthServerUrl, loginRequest.getUsername(), loginRequest.getPassword());

            // Store user details and tokens in the session
            // Spring Session will automatically persist this to the H2 database
            session.setAttribute("username", loginRequest.getUsername());
            session.setAttribute("gl_token", glToken);
            session.setAttribute("sl_token", slToken);

            return ResponseEntity.ok("Login successful. Session created.");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Login failed: " + e.getMessage());
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpServletRequest request) {
        request.getSession().invalidate();
        return ResponseEntity.ok("Logout successful.");
    }
}
```

-----

### \#\# 4. Integrate Session with OpenShift Client

Now, refactor your AOP aspect to use the tokens from the user's session to create a new `OpenShiftClient` for each request.

#### **Step 1: Refactor `OpenShiftServiceImpl`**

The service no longer needs to initialize or store clients. It will only manage the `ThreadLocal` active client for the current request.

**`com/barclays/iportalmonitoring/service/impl/OpenShiftServiceImpl.java`**

```java
@Service
public class OpenShiftServiceImpl implements OpenShiftService {

    private static final Logger log = LoggerFactory.getLogger(OpenShiftServiceImpl.class);
    // ThreadLocal holds the client for the current thread/request
    private final ThreadLocal<OpenShiftClient> activeClient = new ThreadLocal<>();

    // The ApplicationContext is now needed in the Aspect, not here.
    // The TokenProvider is not needed here anymore for initialization.
    // REMOVE all initialization logic (initializeClients, clientGL, clientSL fields).

    @Override
    public OpenShiftClient getActiveClient() {
        if (activeClient.get() == null) {
            throw new IllegalStateException("No active OpenShift client found for the current request context.");
        }
        return activeClient.get();
    }

    // Method for the Aspect to set the client for the request
    public void setActiveClient(OpenShiftClient client) {
        activeClient.set(client);
    }

    // Method for the Aspect to clear the client after the request
    public void clearActiveClient() {
        activeClient.remove();
    }

    // The old useClient method is no longer needed as the Aspect handles everything.
    // public void useClient(String clusterIdentifier) { ... } // REMOVE THIS
}
```

*Note: Make sure to add `setActiveClient` and `clearActiveClient` to your `OpenShiftService` interface.*

#### **Step 2: Refactor `OpenShiftClientAspect`**

This is the core change. The aspect now retrieves the token from the session and creates a fresh, request-scoped client.

**`com/barclays/iportalmonitoring/aspect/OpenShiftClientAspect.java`**

```java
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.context.ApplicationContext;
// ... other imports

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
        String cluster = findClusterIdentifier(joinPoint); // Your existing method to find "gl" or "sl"
        HttpSession session = request.getSession(false); // false = don't create new session

        if (session == null) {
            throw new IllegalStateException("No active session found. Please log in.");
        }

        String tokenKey = cluster + "_token";
        String token = (String) session.getAttribute(tokenKey);

        if (token == null || token.isEmpty()) {
            throw new IllegalStateException("No OpenShift token found in session for cluster: " + cluster);
        }

        // The OpenShiftClient bean must be @Scope("prototype")
        OpenShiftClient client = applicationContext.getBean(OpenShiftClient.class, cluster, token);
        
        openShiftService.setActiveClient(client);

        try {
            return joinPoint.proceed();
        } finally {
            // IMPORTANT: Clean up the ThreadLocal to avoid memory leaks
            openShiftService.clearActiveClient();
        }
    }

    // Your private findClusterIdentifier method remains the same.
    private String findClusterIdentifier(ProceedingJoinPoint joinPoint) { ... }
}
```

-----

### \#\# 5. Implement Auditing with AOP

Finally, set up an auditing system to log user actions into a separate H2 table.

#### **Step 1: Create Audit Annotation, Entity, and Repository**

**`com/barclays/iportalmonitoring/annotation/Auditable.java`**

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    String action();
}
```

**`com/barclays/iportalmonitoring/entity/AuditLog.java`**

```java
@Entity
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String sessionId;
    private String username;
    private String action;
    private LocalDateTime timestamp;

    // Constructors, Getters, and Setters
}
```

**`com/barclays/iportalmonitoring/repository/AuditLogRepository.java`**

```java
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
}
```

#### **Step 2: Create the Audit Aspect**

This aspect intercepts methods annotated with `@Auditable` and records the activity.

**`com/barclays/iportalmonitoring/aspect/AuditAspect.java`**

```java
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
// ... other imports

@Aspect
@Component
public class AuditAspect {

    private final AuditLogRepository auditLogRepository;
    private final HttpServletRequest request;

    @Autowired
    public AuditAspect(AuditLogRepository auditLogRepository, HttpServletRequest request) {
        this.auditLogRepository = auditLogRepository;
        this.request = request;
    }

    @Before("@annotation(com.barclays.iportalmonitoring.annotation.Auditable)")
    public void logActivity(JoinPoint joinPoint) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            // Or handle as an error, as auditable actions should happen within a session
            return; 
        }

        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Auditable auditable = signature.getMethod().getAnnotation(Auditable.class);

        AuditLog log = new AuditLog();
        log.setSessionId(session.getId());
        log.setUsername((String) session.getAttribute("username"));
        log.setAction(auditable.action());
        log.setTimestamp(LocalDateTime.now());

        auditLogRepository.save(log);
    }
}
```

#### **Step 3: Use the Audit Annotation**

Annotate any service or controller method you want to audit.

```java
@RestController
public class PodsController {
    
    @Autowired
    private PodService podService;

    @GetMapping("/api/pods")
    @Auditable(action = "LIST_PODS")
    @UseOpenShiftClient(cluster = "gl") // Your existing annotation
    public List<Pod> getPodsFromGL() {
        return podService.listPods();
    }
}
```
