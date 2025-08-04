Of course. Based on the code you've provided, you are using Angular Signals with `effect()` to trigger data loading. This is a great modern approach. We can integrate polling into this existing logic cleanly.

The goal is to modify your component so that when the `effect` determines it's time to load data, it **starts a polling process** instead of just fetching once. This polling will automatically stop when the conditions are no longer met (e.g., the user switches tabs).

Here is the step-by-step refactoring of your component to include polling every 10 seconds.

### Summary of Changes

1.  **Introduce Subscription Management:** We'll add a property to hold our polling subscription so we can start and stop it.
2.  **Create `startPolling` and `stopPolling` Methods:** This encapsulates the logic for beginning and ending the data fetch loop.
3.  **Refactor `loadDeployments`:** The core API call logic will be used inside the polling mechanism.
4.  **Update the `effect`:** The `effect` will now be responsible for calling `startPolling()` and `stopPolling()` at the right times, using its built-in `onCleanup` function for perfect lifecycle management.
5.  **Add `ngOnDestroy`:** A final safety net to ensure everything is cleaned up.

-----

### Refactored Component Code

Here is your component code, modified to include the polling logic. Pay close attention to the comments explaining each change.

```typescript
import { Component, OnDestroy, effect, signal } from '@angular/core';
import { AppService } from '../services/app.service'; // Assuming paths
import { ApiHttpService } from '../services/api-http.service'; // Assuming paths
import { Subscription, timer, switchMap, tap, catchError, of } from 'rxjs';

@Component({
  // ... your component decorator
})
export class YourDataTableComponent implements OnDestroy {
  rowData: any[] = [];
  applications: string[] = []; // Assuming this is populated somewhere
  clusters: string[] = []; // Assuming this is populated somewhere
  columns: any[] = []; // Assuming this is populated somewhere
  tableData: any = {};
  isDataLoading = signal(false); // Using a signal for loading state is a good practice

  // --- NEW: To manage the polling subscription ---
  private pollingSubscription?: Subscription;

  constructor(
    public appService: AppService,
    private apiService: ApiHttpService
  ) {
    // Your existing effect for project selection
    effect(() => {
      const project = this.appService.selectedProject();
      if (project) {
        this.applications = []; // This seems fine
      }
    });

    // --- MODIFIED: The main effect now controls polling ---
    effect((onCleanup) => {
      const isActiveTab = this.appService.selectedTab() === this.tabId; // Assuming you have tabId
      const project = this.appService.selectedProject();

      if (isActiveTab && project) {
        // When conditions are met, start the polling process.
        this.startPolling();
      }

      // The onCleanup function is perfect for this. It runs when the
      // effect is destroyed or re-evaluates.
      onCleanup(() => {
        this.stopPolling();
      });
    });
  }

  /**
   * --- NEW: Stops any active polling subscription ---
   * Cleans up the subscription and resets the state.
   */
  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
    this.rowData = [];
    this.isDataLoading.set(false);
  }

  /**
   * --- NEW: Starts the polling process ---
   * It will fetch data immediately and then every 10 seconds.
   */
  private startPolling(): void {
    // Ensure no previous poll is running
    this.stopPolling();

    // Use timer(0, 10000) to start immediately, then every 10s
    this.pollingSubscription = timer(0, 10000).pipe(
      // Use tap to set loading state before each request
      tap(() => this.isDataLoading.set(true)),
      // switchMap cancels previous pending requests and switches to the new one
      switchMap(() => {
        const project = this.appService.selectedProject();
        const cluster = "both"; // From your original code
        return this.apiService.getAllAppResource(cluster, project);
      }),
      // Handle potential errors so the polling doesn't stop
      catchError(error => {
        console.error('Error during polling:', error);
        this.isDataLoading.set(false); // Turn off loading on error
        // Return an empty observable to keep the timer alive
        return of(null);
      })
    ).subscribe(data => {
      // If an error occurred, data might be null, so we check for it
      if (data) {
        // The original logic from `loadDeployments` is now here
        this.processData(data);
      }
    });
  }

  /**
   * `processData` remains exactly the same as in your image.
   * It's called after each successful poll.
   */
  processData(data: any) {
    this.tableData = data;
    const rows: any[] = [];
    // Your existing logic for Object.keys, forEach loops...
    this.applications.forEach((app: string) => {
      const temp: any = {};
      temp["appName"] = app;
      this.clusters.forEach((clust: string) => {
        const lclust = clust.toLowerCase();
        this.columns.forEach((col: any) => {
          temp[col.key + "_" + lclust] = this.tableData[app][lclust][col.key];
        });
      });
      rows.push(temp);
    });

    this.isDataLoading.set(false); // Set loading to false after processing
    this.rowData = rows;
  }

  /**
   * --- MODIFIED: Implement OnDestroy as a safeguard ---
   * This ensures that if the component is destroyed, polling stops.
   */
  ngOnDestroy(): void {
    this.stopPolling();
  }
}
```

### Explanation of Key Changes

1.  **`startPolling()` Method**: This is the core of the new logic.

      * `timer(0, 10000)`: Creates an Observable that emits a value immediately, and then every 10,000 milliseconds (10 seconds).
      * `.pipe()`: Allows us to chain RxJS operators.
      * `tap(() => this.isDataLoading.set(true))`: Before each API call, we use `tap` to perform a side-effect: setting the loading flag to `true`.
      * `switchMap(...)`: This is the most important operator here. Every time `timer` emits, `switchMap` subscribes to the inner `apiService.getAllAppResource()` call. If a new value arrives from the timer while a previous API call is still in flight, `switchMap` will automatically cancel the old one. This prevents race conditions.
      * `catchError(...)`: If the API call fails, the entire observable stream would normally terminate. `catchError` "catches" the error, allows you to handle it (like logging it), and then returns a new observable (`of(null)`) so that the polling `timer` continues to run.

2.  **`stopPolling()` Method**: A simple helper to unsubscribe from any active `pollingSubscription` and reset the component's state. This is crucial for preventing memory leaks.

3.  **Modified `effect()`**:

      * Your `effect` is now much cleaner. Its only job is to check the conditions (`isActiveTab`, `project`).
      * If the conditions are met, it calls `this.startPolling()`.
      * The magic is `onCleanup(() => { this.stopPolling(); })`. This function is provided by `effect` and runs automatically whenever the `effect` is about to re-run or be destroyed. It's the perfect place to stop the polling, ensuring no stray timers are left running when the user navigates away or the project changes.

This refactored code aligns perfectly with your existing logic, embraces modern Angular features, and implements robust, leak-free polling.


SCSS

/* Styles for when the toggle is in a "normal" on-state */
.custom-toggle.is-on {
  --mdc-switch-selected-track-color: #1a73e8; // Blue track
  --mdc-switch-selected-handle-color: #ffffff;
  --mdc-switch-selected-state-layer-color: #1a73e8;
}

/* Styles for when the toggle is in a "critical" on-state */
.custom-toggle.is-critical.is-on {
  --mdc-switch-selected-track-color: #d93025; // Red track
  --mdc-switch-selected-handle-color: #ffffff;
  --mdc-switch-selected-state-layer-color: #d93025;
}
2. Apply Classes Dynamically in HTML

Use Angular's [ngClass] directive to apply the styles based on component properties.

HTML

<mat-slide-toggle
    class="custom-toggle"
    [ngClass]="{ 
        'is-on': pollingService.isPollingEnabled(), 
        'is-critical': someOtherCondition 
    }"
    [checked]="pollingService.isPollingEnabled()"
    (change)="onToggleChange($event)">
    Critical Refresh
</mat-slide-toggle>
