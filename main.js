# **EagleEye: Unified OpenShift Monitoring Dashboard**

*A Centralized Monitoring and Comparison Tool for OpenShift*

---

## **1. Overview**

**EagleEye** is an enterprise-grade, unified OpenShift monitoring dashboard designed to enhance operational efficiency and team productivity. It provides a centralized, side-by-side comparison of resources across **GL** and **SL** clusters, enabling developers and Site Reliability Engineers (SREs) to systematically identify discrepancies and troubleshoot issues.

### **Key Capabilities**

* **Centralized View:** Provides a single interface to compare OpenShift resources, including deployments, services, pods, and config maps, between GL and SL clusters for any given project.

* **Minimalist UI:** Features a clean and intuitive interface that prioritizes the display of essential data to facilitate focused analysis.

* **Color-Coded Differences:** Employs visual tagging to instantly highlight configuration drift. Resources are marked to indicate whether they are identical, different, or absent in a corresponding cluster.

* **Zero-Login Access:** The dashboard is accessible in a secure **read-only mode** via a pre-configured service account, allowing for quick operational checks and broad organizational visibility.

* **Individual Login:** Users can authenticate with their standard OpenShift credentials to access a range of environments (**np1** through **np6**). All actions performed within an authenticated session are audited for compliance.

* **Multi-Team Support:** Architected to support multiple teams, enabling each to select and monitor their designated projects within the platform.

* **Data Export:** Users can export comparison views to Excel format to share data, report findings, and collaborate with stakeholders.

---

## **2. Backend Architecture**

The backend is developed on the Spring Boot framework, utilizing a modern, modular, and aspect-oriented design to enforce separation of concerns and improve maintainability.

### **Architecture and Data Flow**

The following diagram illustrates the complete request lifecycle, from user interaction to data retrieval and AOP-driven features like client management and auditing.

```mermaid
graph TD
    subgraph Initialization [Application Startup]
        direction LR
        A1[application.properties] --> A2["OpenShiftProperties Bean"];
        A3[Read-Only Credentials] --> A4(TokenProvider);
        A4 --> A5(Cache Read-Only Tokens);
    end

    subgraph "Request Lifecycle"
        B1[User Browser] --> B2{Spring Security};
        B2 --> B3[Controller];
        B3 -->|calls| B4[Service Method];
        
        subgraph "AOP Aspects"
            C1(OpenShiftClientAspect)
            C2(AuditAspect)
        end
        
        B4 -- "1. Intercepted by" --> C1;
        B4 -- "2. Intercepted by" --> C2;

        C2 --> |if @Auditable| D3["H2 Database: audit_logs"];

        C1 --> B5{Is User Logged In?};

        subgraph "Read-Only Flow"
            B5 -- No --> B6[Use Cached Read-Only Token];
            B6 --> B7[Create/Set Read-Only OpenShiftClient];
        end

        subgraph "Logged-In User Flow"
            B5 -- Yes --> B8[Get token/env from Session];
            D1["HttpSession (JDBC Store)"] -- provides --> B8;
            B8 --> B9[Create Request-Scoped OpenShiftClient];
        end
        
        B7 --> B10[Service Logic Execution];
        B9 --> B10;

        B10 --> D2[OpenShift API];
        D2 -- "returns data" --> B10;

        subgraph "Token Expiry Handling in OpenShiftClientAspect"
            D2 -- "401 Error" --> B10;
            B10 -- "throws KubernetesClientException" --> C1;
            C1 --> E1{Is User Session?};
            E1 -- "No (Read-Only)" --> A4;
            A4 --> E3["Refresh & Cache Read-Only Token"];
            E3 --> |Retry| B10;
            E1 -- "Yes (User)" --> E4[Invalidate HttpSession];
            E4 --> E5(Return 401 Response);
        end
    end
    
    subgraph "User Authentication"
        B1 --> |"POST /login"| AuthController;
        AuthController -- "uses" --> A2;
        AuthController -- "uses" --> A4;
        A4 --> |"fetches tokens"| D2;
        AuthController --> |"creates"| D1;
    end
    
    B10 --> B3;
    B3 --> |"returns HTTP Response"| B1;
    E5 --> B1;

    subgraph "Data Stores"
        D1
        D3
    end

    %% Styling
    style Initialization fill:#e6f3ff,stroke:#333,stroke-width:2px;
    style "AOP Aspects" fill:#fff2cc,stroke:#333,stroke-width:2px;
    style "User Authentication" fill:#e6ffe6,stroke:#333,stroke-width:2px;
```

### **Technical Features**

* **Aspect-Oriented Programming (AOP):** Core cross-cutting concerns are managed declaratively through custom annotations:
    * `@UseOpenShiftClient`: Intercepts service calls to transparently manage the lifecycle of `OpenShiftClient` instances, handling both read-only and user session contexts.
    * `@ClusterIdentifier`: A parameter-level annotation used by the aspect to determine which cluster (`gl` or `sl`) a request is targeting.
    * `@Auditable`: A method-level annotation that triggers the `AuditAspect` to log user actions to the database for compliance and tracking purposes.
* **Real-time Event Streaming:** The backend utilizes the **Fabric8 Watch API** to establish a persistent connection to the OpenShift API, enabling the streaming of cluster events in real-time to the frontend.
* **Dynamic Configuration:** Leverages Spring's `@ConfigurationProperties` to load and manage multi-environment cluster configurations (`np1` - `np6`) into a type-safe, hierarchical Java object, which eliminates hard-coded URLs.
* **Robust Session Management:** Employs **Spring Session JDBC** with an H2 database to provide a persistent and secure session store for authenticated users, ensuring session data integrity across application restarts.

### **Technology and Versions**

| Technology               | Version |
| ------------------------ | ------- |
| Java                     | 17      |
| Spring Boot              | 3.x     |
| Spring Security          | 6.x     |
| Fabric8 OpenShift Client | 6.10.0  |
| H2 Database              | 2.x     |
| Maven                    | 3.x     |

---

## **3. Frontend**

The frontend is a responsive single-page application (SPA) built with Angular, designed to present complex data in a clear and actionable format.

### **Overview of Views**

* **Login Page:** Provides a secure entry point where users select their project and target environment (`np1`-`np6`) before authenticating.
* **Main Dashboard:** The central interface, offering a high-level summary of key resources (Deployments, Services, Pods, etc.) across the GL and SL clusters.
* **Comparison Views:** Includes dedicated tabs for **Services**, **Routes**, **ConfigMaps**, and **ResourceQuotas** with detailed, side-by-side data tables. A filter allows users to display all resources, only differing resources, or only identical resources.
* **Live Events Stream:** A dedicated view that displays a real-time feed of events from the OpenShift project, such as pod creations, deletions, and build warnings.
* **Detailed Modals:** Clicking on any resource opens a detailed modal view, presenting specific metadata, configurations, or live pod logs without requiring navigation away from the main dashboard.

### **Key Features**

* **Automatic Data Refresh:** The dashboard polls the backend every **5 minutes** to ensure the data presented remains current, providing a near-real-time view of the cluster state.
* **Responsive Read-Only View:** The UI is fully functional in read-only mode, with all comparison and data-fetching features enabled.

### **Technology and Versions**

| Technology   | Version |
| ------------ | ------- |
| Angular      | 15.x    |
| TypeScript   | 4.x     |
| RxJS         | 7.x     |
| HTML5 / CSS3 | N/A     |
