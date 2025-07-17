import { Component } from '@angular/core';
import { ColDef } from 'ag-grid-community';
// Import the new progress bar renderer
import { ProgressBarRendererComponent } from './progress-bar-renderer/progress-bar-renderer.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  public columnDefs: ColDef[] = [
    {
      headerName: 'Quota Name',
      field: 'quota-name',
      width: 150,
    },
    {
      headerName: 'Gloucester',
      field: 'b-compute-quota.gl',
      cellRenderer: ProgressBarRendererComponent, // <-- Use the new renderer
      width: 250,
    },
    {
      headerName: 'Slough',
      field: 'b-compute-quota.sl',
      cellRenderer: ProgressBarRendererComponent, // <-- Use the new renderer
      width: 250,
    },
  ];

  public rowData: any[] = [
    {
      'quota-name': 'Project Alpha',
      'b-compute-quota': {
        gl: {
          used: { 'limits.cpu': '51500m', 'limits.memory': '117534Mi', 'pods': '74' },
          hard: { 'limits.cpu': '120', 'limits.memory': '250Gi', 'pods': '150' },
        },
        sl: {
          used: { 'requests.cpu': '27950m', 'requests.memory': '80532Mi' },
          hard: { 'requests.cpu': '80', 'requests.memory': '250Gi' },
        },
      },
    },
    // Example of another quota with different resource keys
    {
        'quota-name': 'Project Beta',
        'b-compute-quota': {
          gl: {
            used: { 'storage': '500Gi', 'gpu.count': '2' },
            hard: { 'storage': '1000Gi', 'gpu.count': '4' },
          },
          sl: {
            used: { 'storage': '750Gi', 'gpu.count': '3' },
            hard: { 'storage': '1000Gi', 'gpu.count': '4' },
          },
        },
    }
  ];

  public defaultColDef: ColDef = {
    flex: 1,
    resizable: true,
  };
}








.progress-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px; /* Space between each progress bar */
  width: 100%;
  height: 100%;
  padding: 8px 4px;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px; /* Space between the bar and the percentage label */
}

.progress-bar-background {
  flex-grow: 1;
  height: 10px;
  background-color: #e9ecef;
  border-radius: 5px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: #28a745; /* Green color from your image */
  border-radius: 5px;
  transition: width 0.4s ease-out;
}

.progress-label {
  font-size: 13px;
  font-family: sans-serif;
  color: #333;
  min-width: 40px; /* Ensures alignment */
  text-align: left;
}








<div class="progress-container">
  <div *ngFor="let resource of resources" class="progress-row" [title]="resource.title">
    <div class="progress-bar-background">
      <div class="progress-bar-fill" [style.width]="resource.percentage + '%'"></div>
    </div>
    <span class="progress-label">{{ resource.displayValue }}</span>
  </div>
</div>







import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

// Interface to hold the processed data for our template
interface ResourceProgress {
  title: string;
  percentage: number;
  displayValue: string;
}

@Component({
  selector: 'app-progress-bar-renderer',
  templateUrl: './progress-bar-renderer.component.html',
  styleUrls: ['./progress-bar-renderer.component.css']
})
export class ProgressBarRendererComponent implements ICellRendererAngularComp {
  public resources: ResourceProgress[] = [];

  agInit(params: ICellRendererParams): void {
    const locationData = params.value;
    if (!locationData || !locationData.used || !locationData.hard) {
      return;
    }

    const usedData = locationData.used;
    const hardData = locationData.hard;

    // Dynamically get resource keys from the 'used' object.
    // This handles cases where different quotas have different resource types.
    const resourceKeys = Object.keys(usedData);

    this.resources = resourceKeys
      .map(key => {
        // Ensure the corresponding 'hard' limit exists before processing
        if (hardData[key] === undefined) {
          return null;
        }

        const usedValue = this.parseResourceValue(usedData[key]);
        const hardValue = this.parseResourceValue(hardData[key]);
        
        // Calculate percentage, avoiding division by zero
        const percentage = hardValue > 0 ? (usedValue / hardValue) * 100 : 0;
        const { title } = this.getResourceMetadata(key);

        return {
          title: title,
          percentage: Math.round(percentage),
          displayValue: `${Math.round(percentage)}%`
        };
      })
      .filter(r => r !== null) as ResourceProgress[]; // Filter out any unprocessed resources
  }

  // Utility to parse resource strings (e.g., "51500m", "250Gi") into comparable numbers
  parseResourceValue(value: string): number {
    if (value.endsWith('m')) { // Milli-cores to cores
      return parseFloat(value) / 1000;
    }
    if (value.endsWith('Mi')) { // Mebibytes to Gibibytes
      return parseFloat(value) / 1024;
    }
    if (value.endsWith('Gi')) { // Gibibytes
      return parseFloat(value);
    }
    if (value.endsWith('Ti')) { // Tebibytes to Gibibytes
        return parseFloat(value) * 1024;
    }
    // For plain numbers like pods or CPU cores
    return parseFloat(value);
  }

  // Helper to get a clean title for the resource
  getResourceMetadata(resourceKey: string): { title: string } {
    if (resourceKey.includes('cpu')) return { title: 'CPU' };
    if (resourceKey.includes('memory')) return { title: 'Memory' };
    if (resourceKey.includes('pods')) return { title: 'Pods' };
    // Fallback for any other resource types
    return { title: resourceKey.split('.').pop() || resourceKey };
  }

  refresh(params: ICellRendererParams): boolean {
    return false;
  }
}
