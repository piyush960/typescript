import { Component } from '@angular/core';

@Component({
  selector: 'my-app',
  template: `
    <ag-grid-angular
      style="width: 100%; height: 600px;"
      class="ag-theme-alpine"
      [rowData]="rowData"
      [columnDefs]="columnDefs"
      [frameworkComponents]="{ 
        resourceSpark: ResourceSparklineRenderer 
      }"
      [defaultColDef]="{ resizable: true, flex: 1 }">
    </ag-grid-angular>
  `
})
export class AppComponent {
  columnDefs = [
    {
      headerName: 'Quota',
      field: 'quota-name',
      tooltipField: 'quota-name'
    },
    {
      headerName: 'Gloucester',
      field: 'gl',
      cellRenderer: 'resourceSpark',
      headerTooltip: 'Gloucester quota usage'
    },
    {
      headerName: 'Slough',
      field: 'sl',
      cellRenderer: 'resourceSpark',
      headerTooltip: 'Slough quota usage'
    }
  ];

  rowData = [
    {
      'quota-name': 'b-compute-quota',
      gl: {
        used: {
          'limits.cpu': '51500m',
          'limits.memory': '117534Mi',
          pods: '74',
          'requests.cpu': '27950m',
          'requests.memory': '80532Mi',
        },
        hard: {
          'limits.cpu': '120',
          'limits.memory': '250Gi',
          pods: '150',
          'requests.cpu': '80',
          'requests.memory': '250Gi',
        }
      },
      sl: {
        used: {
          'limits.cpu': '51500m',
          'limits.memory': '117534Mi',
          pods: '74',
          'requests.cpu': '27950m',
          'requests.memory': '80532Mi',
        },
        hard: {
          'limits.cpu': '120',
          'limits.memory': '250Gi',
          pods: '150',
          'requests.cpu': '80',
          'requests.memory': '250Gi',
        }
      }
    },
    // ... more rows
  ];
}


import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { AgChartOptions } from 'ag-charts-community';

@Component({
  selector: 'resource-chart-renderer',
  template: `
    <ag-charts-angular
      class="mini-chart"
      [options]="chartOptions">
    </ag-charts-angular>
  `,
  styles: [`
    .mini-chart {
      width: 100%;
      height: 100px;
    }
  `]
})
export class ResourceChartRenderer implements ICellRendererAngularComp {
  chartOptions!: AgChartOptions;

  private readonly metrics = [
    { key: 'limits.cpu',    label: 'CPU (m)'     },
    { key: 'limits.memory', label: 'Memory (Mi)' },
    { key: 'pods',          label: 'Pods'        },
    { key: 'requests.cpu',  label: 'Req CPU'     },
    { key: 'requests.memory', label: 'Req Mem'   },
  ];

  agInit(params: any): void {
    const used   = this.metrics.map(m => parseFloat(params.value.used[m.key].replace(/[a-zA-Z]+/, '')));
    const hard   = this.metrics.map(m => parseFloat(params.value.hard[m.key].replace(/[a-zA-Z]+/, '')));
    const percent = used.map((u, i) => hard[i] > 0 ? Math.round(u / hard[i] * 100) : 0);

    this.chartOptions = {
      autoSize: true,
      data: this.metrics.map((m, i) => ({
        metric: m.label,
        used: percent[i],
        remaining: 100 - percent[i]
      })),
      series: [
        {
          type: 'column',
          xKey: 'metric',
          yKey: 'used',
          yName: 'Used %',
          tooltip: {
            renderer: ({datum}: any) => ({
              content: `${datum.metric}: ${datum.used}%`
            })
          }
        }
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: 0 } },
        { type: 'number', position: 'left', visible: false, nice: false, domain: [0, 100] }
      ],
      padding: { top: 10, right: 10, bottom: 20, left: 10 },
      legend: { enabled: false },
      title: { text: '' }
    };
  }

  refresh(): boolean { return false; }
}



// in your AppComponent
columnDefs = [
  { headerName: 'Quota', field: 'quota-name', tooltipField: 'quota-name' },
  {
    headerName: 'Gloucester',
    field: 'gl',
    cellRenderer: 'resourceChart',
    headerTooltip: 'Gloucester quota usage'
  },
  {
    headerName: 'Slough',
    field: 'sl',
    cellRenderer: 'resourceChart',
    headerTooltip: 'Slough quota usage'
  }
];

frameworkComponents = {
  resourceChart: ResourceChartRenderer
};
