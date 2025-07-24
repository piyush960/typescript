Of course. We can enhance the custom panel to be a dropdown menu and to visually group the columns just like they appear in the grid.

Here is the updated implementation.

-----

### 1\. Update the Logic (`column-toggle-panel.component.ts`) ⚙️

We'll add a flag to control the dropdown's visibility and modify our `ColumnState` to include the group name, which we'll use for adding separators.

```typescript
// src/app/column-toggle-panel/column-toggle-panel.component.ts

import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GridApi, Column } from '@ag-grid-community/core';

interface ColumnState {
  colId: string;
  headerName: string | undefined;
  hide: boolean | undefined;
  // ✅ Add property to store the parent group's name
  groupName: string | null;
}

@Component({
  selector: 'app-column-toggle-panel',
  templateUrl: './column-toggle-panel.component.html',
  styleUrls: ['./column-toggle-panel.component.css']
})
export class ColumnTogglePanelComponent implements OnChanges {
  @Input() gridApi: GridApi | undefined;
  
  public columnStates: ColumnState[] = [];
  // ✅ Add property to manage dropdown visibility
  public isDropdownOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gridApi'] && this.gridApi) {
      this.syncColumnStates();
    }
  }

  syncColumnStates(): void {
    if (!this.gridApi) return;
    
    const allColumns: Column[] = this.gridApi.getColumns() || [];
    this.columnStates = allColumns.map(column => {
      const parent = column.getParent;
      return {
        colId: column.getColId(),
        headerName: column.getColDef().headerName,
        hide: column.isVisible() === false,
        // ✅ Get the group name from the parent column
        groupName: parent ? parent.getColDef().headerName || null : null
      };
    });
  }

  onColumnToggle(event: any, colId: string): void {
    if (!this.gridApi) return;
    this.gridApi.setColumnsVisible([colId], event.target.checked);
  }
  
  // ✅ Add method to toggle the dropdown
  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }
}
```

-----

### 2\. Update the UI (`column-toggle-panel.component.html`) 🖼️

Here, we'll change the static list into a dropdown menu and add logic inside the `*ngFor` loop to render a header whenever the column group changes.

```html
<div class="dropdown-container">
  <button (click)="toggleDropdown()" class="dropdown-button">
    Show/Hide Columns ▾
  </button>

  <div *ngIf="isDropdownOpen" class="dropdown-menu">
    <div *ngFor="let col of columnStates; let i = index" class="dropdown-item">

      <div *ngIf="col.groupName && (i === 0 || col.groupName !== columnStates[i-1].groupName)">
        <strong class="group-header">{{ col.groupName }}</strong>
        <hr class="group-separator">
      </div>
      
      <label>
        <input 
          type="checkbox"
          [checked]="!col.hide"
          (change)="onColumnToggle($event, col.colId)"
        />
        <span class="column-label">{{ col.headerName }}</span>
      </label>
    </div>
  </div>
</div>
```

-----

### 3\. Add Dropdown Styles (`column-toggle-panel.component.css`) 🎨

Add these styles to make the component look and behave like a dropdown menu.

```css
/* src/app/column-toggle-panel/column-toggle-panel.component.css */

.dropdown-container {
  position: relative; /* Establishes a positioning context */
  display: inline-block;
  margin-bottom: 10px;
}

.dropdown-button {
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  min-width: 180px;
  text-align: left;
}

.dropdown-menu {
  position: absolute;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  padding: 10px;
  z-index: 1000; /* Ensures it appears above other content */
  min-width: 250px;
  max-height: 400px;
  overflow-y: auto;
}

.dropdown-item label {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 4px 0;
  cursor: pointer;
}

.column-label {
  margin-left: 8px;
}

.group-header {
  display: block;
  font-size: 0.9em;
  color: #555;
  margin-top: 10px;
  padding-left: 2px;
}

.group-separator {
  border: 0;
  border-top: 1px solid #eee;
  margin: 4px 0 8px 0;
}
```

Now your custom component is a dropdown that neatly groups your "Gloucester" and "Slough" columns with headers and separators, just like in the grid itself.
