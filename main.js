import { Component } from '@angular/core';
// Make sure to import Column from ag-grid-community
import { ColDef, ColGroupDef, GridApi, GridReadyEvent, Column } from 'ag-grid-community';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';

// Helper function to convert hex color to the ARGB format exceljs needs
const getARGBFromHex = (hex: string | null | undefined): string => {
  if (!hex) return 'FFFFFFFF'; // Default to white if no color
  const hexValue = hex.replace('#', '');
  return 'FF' + hexValue.toUpperCase();
};

@Component({
  // ... your component decorator
})
export class YourComponent {
  private gridApi!: GridApi;

  // ... your existing properties: columnDefs, rowData, clusters, etc.

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
  
  /**
   * Helper function to get the full header name for a column, including its parent group.
   * This creates flattened headers like "Gloucester - CPU Request".
   */
  private getFullHeaderName(column: Column): string {
    const colDef = column.getColDef();
    const parent = column.getParent();

    // Check if the column is in a group and the group has a header name
    if (parent && parent.getColDef().headerName) {
      return `${parent.getColDef().headerName} - ${colDef.headerName}`;
    }
    
    // Otherwise, just return the column's own header name
    return colDef.headerName || '';
  }

  async exportToExcel() {
    if (!this.gridApi) {
      console.error('Grid API not available.');
      return;
    }

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Application Data');

    // 1. Get all displayed columns from the Grid API.
    // This is the key change to handle your complex/grouped structure.
    const allColumns = this.gridApi.getAllDisplayedColumns();

    // 2. Add Header Row
    // We use the helper function to create flattened header names.
    const headerNames = allColumns.map(col => this.getFullHeaderName(col));
    const headerRow = worksheet.addRow(headerNames);
    
    // Style the header row
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }; // Light Grey
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // 3. Add Data Rows and Apply Styles
    this.gridApi.forEachNode(node => {
      // Create an array of data for the current row based on the displayed columns
      const rowData = allColumns.map(column => this.gridApi.getValue(column, node));
      const row = worksheet.addRow(rowData);

      // 4. Iterate over the cells of the new row to apply styles
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const column = allColumns[colNumber - 1];
        if (!column) return;

        const colDef = column.getColDef();
        
        // Check if the column has a cellStyle function
        if (colDef.cellStyle && typeof colDef.cellStyle === 'function') {
          // Build the exact same params object that AG Grid uses
          const styleParams = {
            value: cell.value,
            data: node.data,
            node: node,
            colDef: colDef,
            column: column,
            api: this.gridApi,
            context: this.gridApi.getContext()
          };

          // Run your original cellStyle function to get the result
          const cellStyleResult = colDef.cellStyle(styleParams);

          // Apply the background color if the function returned one
          if (cellStyleResult && cellStyleResult.backgroundColor) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: getARGBFromHex(cellStyleResult.backgroundColor) }
            };
          }
        }
      });
    });

    // 5. Adjust column widths for better readability
    worksheet.columns.forEach(column => {
      let maxColumnLength = 0;
      if (column && column.values) {
        column.values.forEach(value => {
          // Header is value[1], data starts from value[2]
          const cellValue = value ? String(value) : '';
          maxColumnLength = Math.max(maxColumnLength, cellValue.length);
        });
        column.width = maxColumnLength < 12 ? 12 : maxColumnLength + 2;
      }
    });

    // 6. Generate and Download the Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'application-data-export.xlsx');
  }
}
