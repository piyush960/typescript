# **EagleEye: Onboarding New Teams and Environments**

**Document Owner:** Platform Engineering
**Audience:** Application Administrators, Development Team Leads

---

## **1. Introduction**

This document provides a standard operating procedure for onboarding new teams and their corresponding OpenShift environments into the **EagleEye Monitoring Dashboard**. The application is designed to be highly extensible, allowing for seamless integration of new projects and infrastructure without requiring code changes.

Configuration is managed entirely through the central `application.properties` file.

## **2. Understanding the Configuration Structure**

The EagleEye configuration follows a logical, hierarchical structure. There are two primary sections that work together:

1.  **`teams`**: This section maps a team name to a list of environments they are authorized to access.
2.  **`openshiftc.environments`**: This section defines the specific connection details (API and authentication URLs) for each environment.

This separation ensures that environment details can be defined once and referenced by multiple teams if necessary.

### **Property Key Breakdown**

The property keys follow a consistent pattern:

* **Team-to-Environment Mapping:**
    `teams.environments.[team_name]=[env1],[env2],...`
    * `[team_name]`: The identifier for the team (e.g., `iportal`, `dcp`).
    * `[env1],[env2]`: A comma-separated list of environment identifiers (e.g., `np1`, `np2`).

* **Environment-to-URL Mapping:**
    `openshiftc.environments.[env_name].[cluster_name].[url_type]`
    * `[env_name]`: The unique identifier for an environment (e.g., `np1`).
    * `[cluster_name]`: The specific cluster within the environment (`gl` or `sl`).
    * `[url_type]`: The type of server URL (`api-server` or `auth-server`).

## **3. Onboarding a New Team and Environments**

Follow these steps to add a new team and its associated environments to the EagleEye dashboard.

### **Step 1: Define the New Team and its Environments**

First, create a mapping between the new team's name and the environments they will access.

1.  Open the `application.properties` file.
2.  Navigate to the `teams.environments` section.
3.  Add a new line following the pattern `teams.environments.[team_name]=[env_list]`.

**Example:** To add a new team named **`finance`** that will access environments **`np7`** and **`np8`**, you would add the following line:

```properties
teams.environments.finance=np7,np8
```

### **Step 2: Define the New Environment URLs**

Next, provide the connection details for the new environments (`np7` and `np8`) defined in the previous step.

1.  In the same `application.properties` file, navigate to the `openshiftc.environments` section.
2.  For each new environment, add a block of four lines defining the API and authentication server URLs for both the `gl` and `sl` clusters.

**Example:** To configure the `np7` and `np8` environments, you would add the following blocks:

```properties
# Configuration for the new np7 environment
openshiftc.environments.np7.gl.api-server=[https://api.np7-gl.yourcompany.com:6443](https://api.np7-gl.yourcompany.com:6443)
openshiftc.environments.np7.gl.auth-server=[https://oauth.np7-gl.yourcompany.com](https://oauth.np7-gl.yourcompany.com)
openshiftc.environments.np7.sl.api-server=[https://api.np7-sl.yourcompany.com:6443](https://api.np7-sl.yourcompany.com:6443)
openshiftc.environments.np7.sl.auth-server=[https://oauth.np7-sl.yourcompany.com](https://oauth.np7-sl.yourcompany.com)

# Configuration for the new np8 environment
openshiftc.environments.np8.gl.api-server=[https://api.np8-gl.yourcompany.com:6443](https://api.np8-gl.yourcompany.com:6443)
openshiftc.environments.np8.gl.auth-server=[https://oauth.np8-gl.yourcompany.com](https://oauth.np8-gl.yourcompany.com)
openshiftc.environments.np8.sl.api-server=[https://api.np8-sl.yourcompany.com:6443](https://api.np8-sl.yourcompany.com:6443)
openshiftc.environments.np8.sl.auth-server=[https://oauth.np8-sl.yourcompany.com](https://oauth.np8-sl.yourcompany.com)
```

**Note:** Ensure the URLs are correct for your infrastructure.

### **Step 3: Restart the Application**

For the changes to take effect, the EagleEye Spring Boot application must be restarted. The new configuration will be loaded automatically upon startup.

## **4. Verification**

After the application has restarted, you can verify the new configuration:

1.  Navigate to the EagleEye login page.
2.  The newly added team (e.g., **`finance`**) should now appear in the "Select Team" (or equivalent) dropdown menu.
3.  Upon selecting the new team, the "Select Environment" dropdown should be populated with the environments you mapped (e.g., **`np7`** and **`np8`**).

If the new team and environments are visible, the onboarding process is complete. If not, please review the property keys in the `application.properties` file for any typographical errors.

---

For further assistance, please contact the Platform Engineering team.
