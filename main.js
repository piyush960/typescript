import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { AgChartOptions } from 'ag-charts-community';

@Component({
  selector: 'app-chart-cell-renderer',
  templateUrl: './chart-cell-renderer.component.html',
  styleUrls: ['./chart-cell-renderer.component.css'],
})
export class ChartCellRendererComponent implements ICellRendererAngularComp {
  public chartOptionsList: AgChartOptions[] = [];

  agInit(params: ICellRendererParams): void {
    const locationData = params.value;
    if (!locationData || !locationData.used || !locationData.hard) {
      return;
    }

    const used = locationData.used;
    const hard = locationData.hard;
    const resources = Object.keys(used); // e.g., ['limits.cpu', 'limits.memory', ...]

    // Create a chart for each resource
    this.chartOptionsList = resources.map((resourceKey) => {
      const usedValue = this.parseResourceValue(used[resourceKey]);
      const hardValue = this.parseResourceValue(hard[resourceKey]);
      
      // Define a display-friendly title and unit
      const { title, unit } = this.getResourceMetadata(resourceKey);

      return this.createBulletChartOptions(title, unit, usedValue, hardValue);
    });
  }

  // Utility to create chart options for a bullet chart
  createBulletChartOptions(title: string, unit: string, used: number, hard: number): AgChartOptions {
    return {
      type: 'bullet',
      data: [{
        title: title,
        value: used,
        target: hard,
      }],
      // Make the chart compact
      height: 60,
      width: 250,
      series: [
        {
          valueKey: 'value',
          targetKey: 'target',
          titleKey: 'title',
        },
      ],
      axes: [
        {
          type: 'number',
          position: 'bottom',
          label: {
            formatter: (params) => `${params.value}${unit}`,
          },
        },
        {
          type: 'category',
          position: 'left',
        },
      ],
      legend: { enabled: false },
    };
  }

  // Utility to parse string values like "51500m", "250Gi", "74" into numbers
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
  
  // Helper to get a clean title and unit for the chart
  getResourceMetadata(resourceKey: string): { title: string, unit: string } {
    if (resourceKey.includes('cpu')) return { title: 'CPU', unit: ' cores' };
    if (resourceKey.includes('memory')) return { title: 'Memory', unit: ' Gi' };
    if (resourceKey.includes('pods')) return { title: 'Pods', unit: '' };
    return { title: resourceKey, unit: '' };
  }

  refresh(params: ICellRendererParams): boolean {
    return false;
  }
}



<div class="charts-container">
  <div *ngFor="let options of chartOptionsList" class="chart-wrapper">
    <ag-charts-angular [options]="options"></ag-charts-angular>
  </div>
</div>


.charts-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding-top: 5px;
}

.chart-wrapper {
  margin-bottom: 5px;
}



import { Component } from '@angular/core';
import { ColDef } from 'ag-grid-community';
import { ChartCellRendererComponent } from './chart-cell-renderer/chart-cell-renderer.component';

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
      // Use dot notation to access nested data
      field: 'b-compute-quota.gl',
      cellRenderer: ChartCellRendererComponent,
      width: 300,
    },
    {
      headerName: 'Slough',
      field: 'b-compute-quota.sl',
      cellRenderer: ChartCellRendererComponent,
      width: 300,
    },
  ];

  // Adding 'quota-name' to your sample data
  public rowData: any[] = [
    {
      'quota-name': 'Project Alpha',
      'b-compute-quota': {
        gl: {
          used: {
            'limits.cpu': '51500m', // -> 51.5 cores
            'limits.memory': '117534Mi', // -> 114.7 Gi
            'pods': '74',
          },
          hard: {
            'limits.cpu': '120', // -> 120 cores
            'limits.memory': '250Gi', // -> 250 Gi
            'pods': '150',
          },
        },
        sl: {
          used: {
            'requests.cpu': '27950m', // -> 27.95 cores
            'requests.memory': '80532Mi', // -> 78.6 Gi
            'pods': '74',
          },
          hard: {
            'requests.cpu': '80', // -> 80 cores
            'requests.memory': '250Gi', // -> 250 Gi
            'pods': '150',
          },
        },
      },
    },
     // Add more rows as needed
  ];

  public defaultColDef: ColDef = {
    flex: 1,
    resizable: true,
  };
}




<ag-grid-angular
  style="width: 100%; height: 500px;"
  class="ag-theme-quartz"
  [rowData]="rowData"
  [columnDefs]="columnDefs"
  [defaultColDef]="defaultColDef"
  [autoHeight]="true"
></ag-grid-angular>



import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

// AG Grid & AG Charts Imports
import { AgGridAngular } from 'ag-grid-angular';
import { AgChartsAngular } from 'ag-charts-angular';
import { ChartCellRendererComponent } from './chart-cell-renderer/chart-cell-renderer.component';
import { HttpClientModule } from '@angular/common/http';


@NgModule({
  declarations: [
    AppComponent,
    ChartCellRendererComponent // <-- Declare the renderer
  ],
  imports: [
    BrowserModule,
    AgGridAngular,         // <-- Import AG Grid
    AgChartsAngular,       // <-- Import AG Charts
    HttpClientModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
