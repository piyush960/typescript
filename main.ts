Excellent idea. That's a very common and user-friendly feature. To achieve this, we need to introduce a centralized state management mechanism that all your components can listen to.

The best-practice Angular way to do this is with a shared service that holds the state of the toggle. All components that perform polling will inject this service and react to its changes.

Here is the complete, step-by-step guide to implement a global auto-refresh toggle.

### Step 1: Create a Shared `PollingService`

This service will be the single source of truth for whether auto-refresh is enabled.

**1. Generate the service with the Angular CLI:**

```bash
ng generate service services/polling
```

**2. Implement the service logic:**
We'll use an Angular Signal to hold the state, making it reactive and easy to consume.

```typescript
// src/app/services/polling.service.ts

import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PollingService {
  // Create a writable signal to hold the state.
  // We'll default it to true (auto-refresh is ON).
  readonly isPollingEnabled = signal<boolean>(true);

  constructor() { }

  /**
   * Toggles the current polling state.
   */
  togglePolling(): void {
    this.isPollingEnabled.update(currentValue => !currentValue);
  }

  /**
   * Explicitly sets the polling state.
   * @param isEnabled The desired state.
   */
  setPolling(isEnabled: boolean): void {
    this.isPollingEnabled.set(isEnabled);
  }
}
```

### Step 2: Create the Toggle Button Component

This component can be placed in your app's main layout, like a header or toolbar.

**1. Generate the component:**

```bash
ng generate component shared/auto-refresh-toggle
```

**2. Implement the component logic and template:**
This component injects the `PollingService` to control and display the toggle state. I'll use the Angular Material Slide Toggle for a nice UI, but a simple checkbox works just as well.

**Component (`.ts` file):**

```typescript
// src/app/shared/auto-refresh-toggle/auto-refresh-toggle.component.ts

import { Component } from '@angular/core';
import { PollingService } from '../../services/polling.service';
import { MatSlideToggleModule } from '@angular/material/slide-toggle'; // Example using Angular Material
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-auto-refresh-toggle',
  standalone: true, // Assuming a modern standalone component
  imports: [MatSlideToggleModule, FormsModule],
  templateUrl: './auto-refresh-toggle.component.html',
  styleUrls: ['./auto-refresh-toggle.component.css']
})
export class AutoRefreshToggleComponent {
  // Make the service public so the template can access its signal directly
  constructor(public pollingService: PollingService) {}

  onToggleChange(event: any): void {
    // The 'any' type for event is for compatibility with different UI libraries.
    // For MatSlideToggle, it's MatSlideToggleChange.
    this.pollingService.setPolling(event.checked);
  }
}
```

**Component Template (`.html` file):**

```html
<!-- src/app/shared/auto-refresh-toggle/auto-refresh-toggle.component.html -->

<div class="toggle-container">
  <mat-slide-toggle
    [checked]="pollingService.isPollingEnabled()"
    (change)="onToggleChange($event)"
    labelPosition="before">
    Auto-Refresh (10s)
  </mat-slide-toggle>
</div>
```

Now, you just need to place this component in your app's layout, for example, in `app.component.html`:
`<app-auto-refresh-toggle></app-auto-refresh-toggle>`

-----

### Step 3: Refactor Your Data Table Component

Finally, let's update `YourDataTableComponent` (and your other 3 components) to respect the state from the `PollingService`.

The core idea is to make the main `effect` react to changes in **both** its original dependencies (`isActiveTab`, `project`) AND the new `isPollingEnabled` signal.

```typescript
// In YourDataTableComponent.ts

import { Component, OnDestroy, effect } from '@angular/core';
// ... other imports
import { Subscription, timer, switchMap, tap, catchError, of } from 'rxjs';
import { PollingService } from '../services/polling.service'; // <-- IMPORT THE NEW SERVICE

@Component({
  // ...
})
export class YourDataTableComponent implements OnDestroy {
  // ... (all your existing properties: rowData, isDataLoading, etc.)
  private pollingSubscription?: Subscription;

  constructor(
    public appService: AppService,
    private apiService: ApiHttpService,
    private pollingService: PollingService // <-- INJECT THE SERVICE
  ) {
    // --- MODIFIED: The main effect now also depends on the polling service ---
    effect((onCleanup) => {
      const isActiveTab = this.appService.selectedTab() === this.tabId;
      const project = this.appService.selectedProject();
      const isPollingOn = this.pollingService.isPollingEnabled(); // <-- READ THE SIGNAL

      // Stop any previous activity before deciding what to do next
      this.stopPollingAndClearData();

      if (isActiveTab && project) {
        if (isPollingOn) {
          // If polling is ON, start the polling process.
          this.startPolling();
        } else {
          // If polling is OFF, just fetch the data once.
          this.fetchDataOnce();
        }
      }

      onCleanup(() => {
        this.stopPollingAndClearData();
      });
    });
  }

  // --- NEW: A single method to fetch data one time ---
  fetchDataOnce(): void {
    this.isDataLoading.set(true);
    const project = this.appService.selectedProject();
    const cluster = "both";
    this.apiService.getAllAppResource(cluster, project).pipe(
      catchError(error => {
        console.error('Error during single fetch:', error);
        this.isDataLoading.set(false);
        return of(null);
      })
    ).subscribe(data => {
      if (data) {
        this.processData(data);
      }
    });
  }

  // startPolling and processData methods remain the same as before.
  startPolling(): void {
    // ... (no changes needed here)
  }
  processData(data: any): void {
    // ... (no changes needed here)
  }


  // --- RENAMED & MODIFIED: A clearer cleanup method ---
  private stopPollingAndClearData(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
    // Optionally reset data here if you want the table to clear
    // when toggling or switching tabs.
    // this.rowData = [];
    this.isDataLoading.set(false);
  }

  ngOnDestroy(): void {
    this.stopPollingAndClearData();
  }
}
```

### How It All Works Together

1.  The `PollingService` acts as a global store for the `isPollingEnabled` state.
2.  The `AutoRefreshToggleComponent` modifies this state.
3.  Because `YourDataTableComponent`'s `effect` reads the `pollingService.isPollingEnabled()` signal, it automatically re-runs whenever the toggle is flipped.
4.  When the `effect` re-runs, it checks the new state of the toggle and decides whether to call `startPolling()` or `fetchDataOnce()`.
5.  The `onCleanup` function ensures that whenever the state changes (e.g., user flips the toggle, changes tabs), the previous operation (polling or single fetch) is correctly cancelled before the new one begins.

You can now apply this exact same logic to your other three components. They will all inject the `PollingService` and will all react in unison to the global toggle.
