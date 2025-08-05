Here is the **raw markdown** version of your architecture flow breakdown with proper formatting and keyword highlighting using backticks and markdown conventions:

```markdown
# Breakdown of the Architecture Flow

This section provides a detailed explanation of the different parts of the diagram, matching the flow of the application.

---

## 1. Application Startup & Initialization

- **Properties Loading**:  
  At startup, Spring Boot reads the `application.properties` file and populates the `OpenShiftProperties` bean. This makes all environment and cluster URLs (`np1`-`np6`, `gl`/`sl`) available in a type-safe Java object.

- **Read-Only Token Caching**:  
  The application uses the `TokenProvider` to fetch initial tokens for the read-only service account for both `gl` and `sl` clusters (defaulting to the `np1` environment). These tokens are cached in memory for immediate use by unauthenticated users.

---

## 2. The Request Lifecycle & AOP Interception

- Every incoming request first passes through **Spring Security** and is routed to the appropriate `Controller`.

- The `Controller` calls a method in a `Service` class. This is where the **AOP** logic is applied.

- `@UseOpenShiftClient`:  
  Before the service method executes, the `OpenShiftClientAspect` intercepts the call. Its primary job is to determine the context (**read-only** or **user session**) and set up the correct `OpenShiftClient`.

- `@Auditable`:  
  Similarly, the `AuditAspect` intercepts methods annotated for auditing. If it's a logged-in user, it extracts session details and logs the action to the **H2 database**.

---

## 3. Read-Only (Unauthenticated) Flow

- If the `OpenShiftClientAspect` detects there is no active user session, it retrieves the appropriate cached read-only token (`gl` or `sl` based on the `@ClusterIdentifier` parameter).

- It uses this token to configure an `OpenShiftClient` for the current request.

- The service method then executes using this **read-only client** to fetch data from the **OpenShift API**.

---

## 4. User Login & Session Creation

- When a user logs in via the `AuthController`, their credentials and chosen environment (`np1`, `np2`, etc.) are captured.

- Using the `OpenShiftProperties` bean, the correct auth-server URLs for the chosen environment are looked up.

- The `TokenProvider` fetches user-specific tokens for both `gl` and `sl`.

- A new `HttpSession` is created, and the user's `env`, `tokenGL`, and `tokenSL` are stored as attributes.  
  With `Spring Session JDBC`, this session data is automatically persisted in the **H2 database**.

---

## 5. Logged-In (Authenticated) Flow

- When a request arrives with a valid session cookie, the `OpenShiftClientAspect` detects the active session.

- It retrieves the user's tokens and environment information directly from the `HttpSession`.

- It creates a new, request-scoped `OpenShiftClient` using the user's specific token.  
  This ensures **security** and **isolation** between user requests.

- The service method executes with the **permissions of the authenticated user**.

---

## 6. Token Expiry and Refresh Logic

The architecture correctly handles token expiry for both scenarios:

- **Read-Only Token Expiry**:  
  If a call using the read-only client fails with a `401` error, the `OpenShiftClientAspect` catches the exception, re-fetches a new token using the `TokenProvider`, and automatically retries the original operation.

- **User Session Token Expiry**:  
  If a call using a user's token fails with a `401` error, the aspect catches it, invalidates the user's session (securely logging them out), and sends a `401 Unauthorized` response to the frontend, prompting the user to log in again.
```

Let me know if you want this in a downloadable `.md` file or with a diagram too.
