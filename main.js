Yes, you can absolutely implement this yourself without using the built-in side bar. You can create a separate Angular component that interacts with the AG Grid API to show and hide columns.

This approach gives you full control over the look and feel of your column selector.

-----

### The Strategy 💡

1.  **Create a new component** to act as your custom tool panel.
2.  **Pass the Grid API** from your main component (that hosts the grid) to this new panel component.
3.  In the new component, use the API to **get a list of all columns** and display them with checkboxes.
4.  When a checkbox is clicked, use the API to **set the visibility** of the corresponding column in the grid.

-----

### Step 1: Create the Custom Control Panel Component

First, generate a new component using the Angular CLI.

```bash
ng generate component column-toggle-panel
```

-----

### Step 2: Build the Logic (`column-toggle-panel.component.ts`) ⚙️

This component will receive the `gridApi`, get the column data, and handle the toggle logic.

```typescript
// src/app/column-toggle-panel/column-toggle-panel.component.ts

import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GridApi, Column } from '@ag-grid-community/core';

interface ColumnState {
  colId: string;
  headerName: string | undefined;
  hide: boolean | undefined;
}

@Component({
  selector: 'app-column-toggle-panel',
  templateUrl: './column-toggle-panel.component.html',
  styleUrls: ['./column-toggle-panel.component.css']
})
export class ColumnTogglePanelComponent implements OnChanges {
  @Input() gridApi: GridApi | undefined;
  
  public columnStates: ColumnState[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    // When the gridApi is passed in, initialize the column states
    if (changes['gridApi'] && this.gridApi) {
      this.syncColumnStates();
    }
  }

  syncColumnStates(): void {
    if (!this.gridApi) return;
    
    const allColumns: Column[] = this.gridApi.getColumns() || [];
    this.columnStates = allColumns.map(column => ({
      colId: column.getColId(),
      headerName: column.getColDef().headerName,
      hide: column.isVisible() === false,
    }));
  }

  onColumnToggle(event: any, colId: string): void {
    if (!this.gridApi) return;

    const isChecked = event.target.checked;
    this.gridApi.setColumnsVisible([colId], isChecked);
  }
}
```

-----

### Step 3: Create the UI (`column-toggle-panel.component.html`) 🖼️

This is the template with the list of checkboxes.

```html
<div class="column-panel-container">
  <h4>Show/Hide Columns</h4>
  <div *ngFor="let col of columnStates" class="column-item">
    <label>
      <input 
        type="checkbox"
        [checked]="!col.hide"
        (change)="onColumnToggle($event, col.colId)"
      />
      {{ col.headerName }}
    </label>
  </div>
</div>
```

You can add some basic styling in `column-toggle-panel.component.css`:

```css
.column-panel-container {
  border: 1px solid #ccc;
  padding: 10px;
  margin-bottom: 10px;
  max-width: 300px;
}
.column-item {
  display: block;
  margin-bottom: 5px;
}
```

-----

### Step 4: Integrate into Your Main Component 🔗

Finally, use your new component alongside your grid and pass the `gridApi` to it.

**In your main component's `.ts` file (e.g., `app.component.ts`)**:
Make sure you are saving the `gridApi` from the `onGridReady` event.

```typescript
// src/app/app.component.ts

export class AppComponent {
  public gridApi!: GridApi; // Ensure this is public

  // ... your other properties ...

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
}
```

**In your main component's `.html` file (e.g., `app.component.html`)**:

```html
<app-column-toggle-panel [gridApi]="gridApi"></app-column-toggle-panel>

<ag-grid-angular
  style="width: 100%; height: 500px;"
  class="ag-theme-quartz"
  [rowData]="rowData"
  [columnDefs]="columnDefs"
  (gridReady)="onGridReady($event)"
>
</ag-grid-angular>
```

Now you have a fully custom component for toggling column visibility that is completely independent of the built-in side bar feature.
