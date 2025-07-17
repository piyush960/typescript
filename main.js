To recreate the **circular usage chart** like the one shown in the image using **Angular with AG Charts**, we can use **AG Donut Chart** (part of AG Charts) and customize the labels and colors.

Here’s how to build a reusable **Resource Quota Donut Chart Component** in Angular using **AG Charts**:

---

### 🔧 1. **Install AG Charts**

```bash
npm install ag-charts-community ag-charts-angular
```

---

### 🧩 2. **Angular Component Setup**

#### `resource-quota-chart.component.ts`

```ts
import { Component, Input } from '@angular/core';
import { AgChartOptions } from 'ag-charts-community';

@Component({
  selector: 'app-resource-quota-chart',
  templateUrl: './resource-quota-chart.component.html',
})
export class ResourceQuotaChartComponent {
  @Input() label = 'limits.cpu';
  @Input() percentUsed = 42.9;

  get chartOptions(): AgChartOptions {
    const remaining = 100 - this.percentUsed;
    return {
      data: [
        { category: 'Used', value: this.percentUsed },
        { category: 'Free', value: remaining },
      ],
      series: [
        {
          type: 'donut',
          angleKey: 'value',
          colorKey: 'category',
          colors: ['#4caf50', '#e0e0e0'],
          innerRadiusRatio: 0.75,
          strokeWidth: 0,
        },
      ],
      title: {
        text: `${this.percentUsed}% used`,
        fontSize: 16,
        color: '#333',
      },
      subtitle: {
        text: this.label,
        fontSize: 14,
        color: '#777',
      },
      legend: { enabled: false },
    };
  }
}
```

#### `resource-quota-chart.component.html`

```html
<ag-charts-angular [options]="chartOptions" style="width: 180px; height: 180px;"></ag-charts-angular>
```

---

### 🧪 3. **Use the Component**

#### `app.component.html`

```html
<div style="display: flex; gap: 40px; align-items: center;">
  <app-resource-quota-chart label="limits.cpu" [percentUsed]="42.9"></app-resource-quota-chart>
  <app-resource-quota-chart label="limits.memory" [percentUsed]="45.0"></app-resource-quota-chart>
</div>
```

---

### 🖼️ Output Preview

This setup will give you a donut chart similar to the one in the image:

* A thick circular progress ring
* Green used % and grey remaining
* Label (e.g., `limits.cpu`)
* Centered text showing usage %

---

Would you like to include additional data like **name** or **namespace** below the chart? I can help you include that too.
