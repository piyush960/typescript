You can manage this nested structure by creating corresponding nested Java classes. For Spring's map binding to work best, I recommend a small adjustment to your properties file by adding a common key like `environments`.

Here’s the complete approach.

-----

### \#\# 1. Adjust Your `application.properties` File

Group your environments (`np1`, `np2`) under a single key like `environments`. This enables Spring Boot to bind them into a `Map`, making your code more flexible if you add `np3` later.

**`application.properties`**

```properties
# Group all environments under a common key
openshift.environments.np1.gl.api-server=...
openshift.environments.np1.gl.auth-server=...
openshift.environments.np1.sl.api-server=...
openshift.environments.np1.sl.auth-server=...

openshift.environments.np2.gl.api-server=...
openshift.environments.np2.gl.auth-server=...
openshift.environments.np2.sl.api-server=...
openshift.environments.np2.sl.auth-server=...
```

-----

### \#\# 2. Create Nested Java Configuration Classes

Now, create a Java class structure that exactly mirrors your new properties file structure.

**`OpenShiftProperties.java`**

```java
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
@ConfigurationProperties(prefix = "openshift")
public class OpenShiftProperties {

    /**
     * This field name "environments" matches the key in your properties file.
     * Spring will populate this map with "np1", "np2", etc., as keys.
     */
    private Map<String, EnvironmentConfig> environments;

    // Getter and Setter for the environments map
    public Map<String, EnvironmentConfig> getEnvironments() { return environments; }
    public void setEnvironments(Map<String, EnvironmentConfig> environments) { this.environments = environments; }

    /**
     * Represents a single environment (e.g., np1), which contains gl and sl clusters.
     */
    public static class EnvironmentConfig {
        private ClusterConfig gl;
        private ClusterConfig sl;

        // Getters and Setters for gl and sl
        public ClusterConfig getGl() { return gl; }
        public void setGl(ClusterConfig gl) { this.gl = gl; }
        public ClusterConfig getSl() { return sl; }
        public void setSl(ClusterConfig sl) { this.sl = sl; }
    }

    /**
     * Represents the final cluster configuration with the server URLs.
     * This class remains the same as before.
     */
    public static class ClusterConfig {
        private String apiServer;
        private String authServer;

        // Getters and Setters for apiServer and authServer
        public String getApiServer() { return apiServer; }
        public void setApiServer(String apiServer) { this.apiServer = apiServer; }
        public String getAuthServer() { return authServer; }
        public void setAuthServer(String authServer) { this.authServer = authServer; }
    }
}
```

-----

### \#\# 3. How to Use It in Your Code

Now you can inject `OpenShiftProperties` and traverse the nested structure to get the exact URL you need with just the IDs.

Here’s an example showing how to select the server URLs based on the user's choice.

```java
@Service
public class MySomeService {

    private final OpenShiftProperties openShiftProperties;

    @Autowired
    public MySomeService(OpenShiftProperties openShiftProperties) {
        this.openShiftProperties = openShiftProperties;
    }

    /**
     * Example method to get the API server URL.
     * @param environmentId e.g., "np1"
     * @param clusterId e.g., "gl"
     * @return The API server URL
     */
    public String getApiUrl(String environmentId, String clusterId) {
        // 1. Get the config for the selected environment (np1)
        OpenShiftProperties.EnvironmentConfig envConfig = openShiftProperties.getEnvironments().get(environmentId);
        
        if (envConfig == null) {
            throw new IllegalArgumentException("Invalid environment ID: " + environmentId);
        }

        // 2. Select the gl or sl cluster config
        OpenShiftProperties.ClusterConfig clusterConfig;
        if ("gl".equalsIgnoreCase(clusterId)) {
            clusterConfig = envConfig.getGl();
        } else if ("sl".equalsIgnoreCase(clusterId)) {
            clusterConfig = envConfig.getSl();
        } else {
            throw new IllegalArgumentException("Invalid cluster ID: " + clusterId);
        }
        
        if (clusterConfig == null) {
            throw new IllegalStateException("Configuration missing for cluster: " + clusterId);
        }

        // 3. Return the final api-server URL
        return clusterConfig.getApiServer();
    }
}
```
