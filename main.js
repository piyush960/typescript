import { Component, OnDestroy, OnInit, effect, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { MatRadioChange } from '@angular/material/radio';

// Assuming these services are correctly defined elsewhere
import { AppService } from '../services/app.service';
import { ApiHttpService } from '../services/api-http.service';

@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss'],
  // Define the animation for new items entering the list
  animations: [
    trigger('flyInOut', [
      transition(':enter', [
        // Start state: item is transparent and slightly above its final position
        style({ transform: 'translateY(-20px)', opacity: 0 }),
        // End state: animate to its final position and full opacity
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ])
  ]
})
export class EventsComponent implements OnInit, OnDestroy {
  // --- Component Properties ---
  @Input() tabId: number = 5;
  title = "streaming-events";
  selectedCluster: 'g1' | 's1' = 'g1';
  eventsData = new Map<string, any[]>();
  isLoading = false;

  // --- New properties for advanced features ---
  isStreamingPaused = false;
  readonly MAX_EVENTS = 50; // Set the maximum number of events to display

  private eventSubscription: Subscription | null = null;

  constructor(
    private readonly appService: AppService,
    private readonly apiService: ApiHttpService
  ) {
    // Effect to handle project changes
    effect(() => {
        const project = this.appService.selectedProject();
        if (project) {
            this.eventsData = new Map<string, any[]>();
            // If streaming is not paused, reload events for the new project
            if (!this.isStreamingPaused) {
                this.loadEvents();
            }
        }
    });

    // Effect to handle tab activation
    effect(() => {
        const isActiveTab = this.appService.selectedTab() === this.tabId;
        const project = this.appService.selectedProject();
        if (isActiveTab && project && !this.isStreamingPaused) {
            this.loadEvents();
        }
    });
  }

  ngOnInit(): void {
    // Initial load if the component is created and not paused
    if (!this.isStreamingPaused) {
        this.loadEvents();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeFromStream();
  }

  /**
   * Toggles the event stream between playing and paused states.
   */
  toggleStreaming(): void {
    this.isStreamingPaused = !this.isStreamingPaused;
    if (this.isStreamingPaused) {
      this.unsubscribeFromStream();
    } else {
      this.loadEvents();
    }
  }

  /**
   * Safely unsubscribes from the event stream to close the connection.
   */
  private unsubscribeFromStream(): void {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
      this.eventSubscription = null;
    }
  }

  /**
   * Initiates the event stream connection if not paused.
   */
  loadEvents(): void {
    if (this.isStreamingPaused) {
      return; // Do not load events if the stream is paused
    }

    const project = this.appService.selectedProject();
    if (!project) return;

    this.unsubscribeFromStream(); // Ensure any old connection is closed

    this.eventsData.set(this.selectedCluster, []);
    this.isLoading = true;

    this.eventSubscription = this.apiService
      .streamEventsForProjectAndCluster(project, this.selectedCluster)
      .subscribe({
        next: (newEvent: any) => {
          this.isLoading = false;
          this.processAndAddNewEvent(newEvent);
        },
        error: (err) => {
          console.error('SSE Error:', err);
          this.isLoading = false;
          this.isStreamingPaused = true; // Automatically pause on error
        },
      });
  }

  /**
   * Processes a new event, formats it, and adds it to the timeline.
   * Enforces the MAX_EVENTS limit.
   */
  processAndAddNewEvent(event: any): void {
    const formattedEvent = {
        type: event.type,
        name: event.resourceName,
        namespace: event.resourceNamespace,
        time: this.convertToIST(event.eventTimestamp),
        count: event.count,
        generatedFrom: event.resourceKind,
        message: event.message,
        status: event.type === 'Warning' ? 'warning' : 'normal',
    };

    const currentEvents = this.eventsData.get(this.selectedCluster) || [];

    // Enforce the maximum number of events
    if (currentEvents.length >= this.MAX_EVENTS) {
      currentEvents.pop(); // Remove the oldest event from the end of the array
    }

    // Prepend the new event to the beginning of the array
    this.eventsData.set(this.selectedCluster, [formattedEvent, ...currentEvents]);
  }

  /**
   * Handles the change of cluster selection.
   */
  onClusterChange(event: MatRadioChange): void {
    this.selectedCluster = event.value;
    this.loadEvents(); // Reload events for the newly selected cluster
  }

  /**
   * Converts a UTC time string to a formatted IST string.
   */
  convertToIST(utcTime: string): string {
    if (!utcTime || utcTime === "null") return "N/A";
    const date = new Date(utcTime);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);

    const dateOptions: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
    };

    return new Intl.DateTimeFormat("en-US", dateOptions)
      .format(istDate)
      .replace(" at ", ", ");
  }
}





<b-box [centered]="true">
  <b-box class="table-container">
    <mat-radio-group
      aria-labelledby="example-radio-group-label"
      class="example-radio-group"
      [(ngModel)]="selectedCluster"
      (change)="onClusterChange($event)">
      <mat-radio-button class="example-radio-button" value="g1">
        <span u-type="b1">G1</span>
      </mat-radio-button>
      <mat-radio-button class="example-radio-button" value="s1">
        <span u-type="b1">S1</span>
      </mat-radio-button>
    </mat-radio-group>

    <div class="container u-type">
      <div class="timeline-container">
        <div class="timeline-header">
          <!-- Make the icon container clickable to toggle streaming -->
          <div (click)="toggleStreaming()" class="play-pause-icon">
            <!-- Show PAUSE icon if streaming is active -->
            <h2 *ngIf="!isStreamingPaused" class="flex items-center">
              <b-icon icon="pause-circle" status="success"></b-icon>
              <span>Latest events...</span>
            </h2>
            <!-- Show PLAY icon if streaming is paused -->
            <h2 *ngIf="isStreamingPaused" class="flex items-center">
              <b-icon icon="play-circle" status="error"></b-icon>
              <span>Events paused</span>
            </h2>
          </div>
          <span class="event-count">
            Showing {{ eventsData.get(selectedCluster)?.length || 0 }} events
          </span>
        </div>

        <app-loader [text]="'Getting events...'" *ngIf="isLoading"></app-loader>

        <div class="timeline" *ngIf="!isLoading">
          <!-- Add the animation trigger to each timeline item -->
          <div *ngFor="let event of eventsData.get(selectedCluster)" [@flyInOut] class="timeline-item">
            <div [ngClass]="event.status" class="timeline-marker"></div>
            <div class="timeline-content">
              <div class="event-header">
                <div class="event-title">
                  <span [ngClass]="{
                    'type-badge-warn': event.type?.toLowerCase() === 'warning',
                    'type-badge': event.type?.toLowerCase() !== 'warning'
                  }">{{ event.type }}</span>
                  <a class="event-name">{{ event.name }}</a>
                  <span class="ns-badge">NS: {{ event.namespace }}</span>
                </div>
              </div>
              <div class="event-time-info">
                <span class="time">{{ event.time }}</span>
                <span class="count">Count: {{ event.count }}</span>
              </div>
              <p class="generated-from">
                <strong>{{ event.generatedFrom }}</strong>
              </p>
              <p class="message">{{ event.message }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </b-box>
</b-box>





// Add styles for the new interactive elements

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.play-pause-icon {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  user-select: none; // Prevents text selection on click

  h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px; // Space between icon and text
  }
}

.event-count {
  font-size: 0.875rem;
  color: #6c757d;
}

// Ensure the timeline item has a position for animations
.timeline-item {
  position: relative;
}

// Your existing styles...
.table-container {
  // ...
}

.type-badge, .type-badge-warn {
  // ...
}
