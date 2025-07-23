Of course. Here is the complete Angular frontend code to integrate with the Spring Boot backend you've built.

This solution includes session management via cookies, automatic handling of expired tokens, and route protection.

### \#\# 1. Setup Proxy for Development

To avoid CORS errors when your Angular app (e.g., on `localhost:4200`) calls your backend (on `localhost:8080`), create a proxy.

1.  Create a file named `proxy.conf.json` in the root of your Angular project.

    **`proxy.conf.json`**

    ```json
    {
      "/api": {
        "target": "http://localhost:8080",
        "secure": false,
        "logLevel": "debug"
      }
    }
    ```

2.  Update your `angular.json` file to use this proxy. Find the `serve` configuration and add the `proxyConfig` option.

    **`angular.json`**

    ```json
    ...
    "architect": {
      "serve": {
        "builder": "@angular-devkit/build-angular:dev-server",
        "options": {
          "proxyConfig": "proxy.conf.json"
        },
    ...
    ```

3.  Restart your Angular development server (`ng serve`) for the changes to take effect.

-----

### \#\# 2. Authentication Service

This service will handle login, logout, and manage the user's authentication state within the app.

**`src/app/auth/auth.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // BehaviorSubject to hold the authentication state
  private loggedIn = new BehaviorSubject<boolean>(false);
  
  // Expose the authentication state as an Observable
  isLoggedIn$: Observable<boolean> = this.loggedIn.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    // Note: A robust app might check for an active session on startup,
    // but for cookie-based auth, the interceptor handles this implicitly.
  }

  get isLoggedIn(): boolean {
    return this.loggedIn.getValue();
  }

  login(credentials: { username: string; password: string }): Observable<any> {
    // The interceptor will add withCredentials: true
    return this.http.post('/api/auth/login', credentials).pipe(
      tap(() => {
        this.loggedIn.next(true);
        this.router.navigate(['/dashboard']);
      }),
      catchError((error) => {
        this.loggedIn.next(false);
        // Let the component handle displaying the error message
        throw error; 
      })
    );
  }

  logout() {
    // The interceptor will add withCredentials: true
    this.http.post('/api/auth/logout', {}).subscribe(() => {
      this.handleLogout();
    });
  }

  // Centralized logout logic for the app
  handleLogout() {
    this.loggedIn.next(false);
    this.router.navigate(['/login']);
  }
}
```

-----

### \#\# 3. HTTP Interceptor

This is the most critical piece. It automatically attaches credentials to every request and handles `401 Unauthorized` errors globally by logging the user out.

**`src/app/auth/auth.interceptor.ts`**

```typescript
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Clone the request to add the withCredentials option
    const authReq = request.clone({
      withCredentials: true
    });

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // If the error is 401, the session is invalid or expired
        if (error.status === 401) {
          console.error('Session expired or unauthorized. Logging out.');
          this.authService.handleLogout();
        }
        return throwError(() => error);
      })
    );
  }
}
```

-----

### \#\# 4. Route Guard

This guard protects routes like the dashboard, preventing access if the user isn't logged in according to the `AuthService`.

**`src/app/auth/auth.guard.ts`**

```typescript
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.authService.isLoggedIn) {
      return true;
    } else {
      // Redirect to login page if not authenticated
      this.router.navigate(['/login']);
      return false;
    }
  }
}
```

-----

### \#\# 5. Module and Routing Configuration

Now, let's wire everything together.

#### **`src/app/app.module.ts`**

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AuthInterceptor } from './auth/auth.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule
  ],
  providers: [
    // Register the AuthInterceptor
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

#### **`src/app/app-routing.module.ts`**

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { AuthGuard } from './auth/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [AuthGuard] // Protect this route
  },
  // Redirect empty path to login
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  // Wildcard route for a 404 page (optional)
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
```

-----

### \#\# 6. Components

Finally, here are the simple components for the UI.

#### **`src/app/login/login.component.ts`**

```typescript
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string | null = null;

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }
    this.errorMessage = null;
    this.authService.login(this.loginForm.value).subscribe({
      error: (err) => {
        this.errorMessage = 'Login failed. Please check your credentials.';
        console.error(err);
      }
    });
  }
}
```

#### **`src/app/login/login.component.html`**

```html
<div class="login-container">
  <h2>Login</h2>
  <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
    <div>
      <label for="username">Username</label>
      <input id="username" type="text" formControlName="username">
    </div>
    <div>
      <label for="password">Password</label>
      <input id="password" type="password" formControlName="password">
    </div>
    <button type="submit" [disabled]="loginForm.invalid">Log In</button>
  </form>
  <div *ngIf="errorMessage" class="error-message">
    {{ errorMessage }}
  </div>
</div>
```

#### **`src/app/dashboard/dashboard.component.ts`**

(Assuming you have a `DataService` to fetch data)

```typescript
// Create a data.service.ts if you don't have one
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({providedIn: 'root'})
export class DataService {
  constructor(private http: HttpClient) { }
  getPods(): Observable<any[]> {
    // The interceptor will handle the auth cookie
    return this.http.get<any[]>('/api/pods'); 
  }
}

// dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { DataService } from '../data.service'; // Adjust path if needed
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  pods$: Observable<any[]>;

  constructor(private dataService: DataService, private authService: AuthService) {}

  ngOnInit(): void {
    // Fetch data from a protected endpoint
    this.pods$ = this.dataService.getPods();
  }

  logout() {
    this.authService.logout();
  }
}
```

#### **`src/app/dashboard/dashboard.component.html`**

```html
<div>
  <h2>Dashboard</h2>
  <button (click)="logout()">Logout</button>
  
  <h3>OpenShift Pods (from GL or SL cluster)</h3>
  <div *ngIf="pods$ | async as pods; else loading">
    <ul *ngIf="pods.length > 0; else noPods">
      <li *ngFor="let pod of pods">{{ pod.metadata.name }}</li>
    </ul>
    <ng-template #noPods><p>No pods found.</p></ng-template>
  </div>
  <ng-template #loading><p>Loading pods...</p></ng-template>
</div>
```
