You can handle that by replacing the fixed fields in your `EnvironmentConfig` class with another `Map`. This makes your configuration fully dynamic at every level.

Here’s the updated code.

-----

### \#\# 1. Update the Java Configuration Classes

The only change needed is within the `EnvironmentConfig` inner class. Instead of having separate fields for `gl` and `sl`, you'll have a `Map` to hold any number of clusters.

Your `application.properties` file can now include `st`, `tl`, or any other cluster without requiring code changes.

**`OpenShiftProperties.java`**

```java
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
@ConfigurationProperties(prefix = "openshift")
public class OpenShiftProperties {

    private Map<String, EnvironmentConfig> environments;
    
    // Getter and Setter
    public Map<String, EnvironmentConfig> getEnvironments() { return environments; }
    public void setEnvironments(Map<String, EnvironmentConfig> environments) { this.environments = environments; }

    /**
     * Represents a single environment (e.g., np1).
     * THIS CLASS IS NOW UPDATED to hold a dynamic map of clusters.
     */
    public static class EnvironmentConfig {
        // Replaced fixed fields with a map for flexibility
        private Map<String, ClusterConfig> clusters;

        // Getter and Setter for the clusters map
        public Map<String, ClusterConfig> getClusters() { return clusters; }
        public void setClusters(Map<String, ClusterConfig> clusters) { this.clusters = clusters; }
    }

    /**
     * This inner class remains the same.
     */
    public static class ClusterConfig {
        private String apiServer;
        private String authServer;

        // Getters and Setters
        public String getApiServer() { return apiServer; }
        public void setApiServer(String apiServer) { this.apiServer = apiServer; }
        public String getAuthServer() { return authServer; }
        public void setAuthServer(String authServer) { this.authServer = authServer; }
    }
}
```

-----

### \#\# 2. How to Use the Fully Dynamic Configuration

Accessing the nested configuration now involves a double map lookup, which is straightforward.

```java
@Service
public class MySomeService {

    private final OpenShiftProperties openShiftProperties;

    @Autowired
    public MySomeService(OpenShiftProperties openShiftProperties) {
        this.openShiftProperties = openShiftProperties;
    }

    /**
     * Example method to get a specific URL.
     * @param environmentId e.g., "np1"
     * @param clusterId e.g., "gl", "st", "tl"
     * @return The API server URL
     */
    public String getApiUrl(String environmentId, String clusterId) {
        // 1. Get the config for the selected environment (np1)
        OpenShiftProperties.EnvironmentConfig envConfig = openShiftProperties.getEnvironments().get(environmentId);
        if (envConfig == null) {
            throw new IllegalArgumentException("Invalid environment ID: " + environmentId);
        }

        // 2. Get the config for the selected cluster (st) from the inner map
        OpenShiftProperties.ClusterConfig clusterConfig = envConfig.getClusters().get(clusterId);
        if (clusterConfig == null) {
            throw new IllegalArgumentException("Invalid cluster ID '" + clusterId + "' for environment '" + environmentId + "'");
        }
        
        // 3. Return the final api-server URL
        return clusterConfig.getApiServer();
    }
}
```
