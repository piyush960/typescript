import { Component } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';

// Helper function to convert hex to ARGB for exceljs
const getARGBFromHex = (hex) => {
  if (!hex) return 'FFFFFFFF'; // Default to white if no color
  const hexValue = hex.replace('#', '');
  return 'FF' + hexValue.toUpperCase();
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private gridApi!: GridApi;

  public columnDefs: ColDef[] = [
    { field: 'make' },
    { field: 'model' },
    { 
      field: 'price',
      // The SAME logic here will be used for the export
      cellStyle: params => {
        if (params.value > 70000) {
          // A rich green for expensive cars
          return { backgroundColor: '#d5f5e3' }; 
        }
        if (params.value < 30000) {
          // A light red for cheaper cars
          return { backgroundColor: '#f5dddd' };
        }
        return null; // No specific style
      }
    }
  ];

  public rowData = [
    { make: 'Toyota', model: 'Celica', price: 35000 },
    { make: 'Ford', model: 'Mondeo', price: 32000 },
    { make: 'Porsche', model: 'Boxster', price: 72000 },
    { make: 'Mercedes', model: 'C-Class', price: 95000 },
    { make: 'BMW', model: 'M3', price: 68000 },
    { make: 'Honda', model: 'Civic', price: 28000 },
  ];

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  async exportToExcel() {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Styled Export');

    // 1. Add Headers
    const headerRow = worksheet.addRow(
      this.columnDefs.map(colDef => colDef.field)
    );
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }, // A light grey background
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // 2. Add Data Rows and Apply Styles
    this.gridApi.forEachNode(node => {
      const rowData = this.columnDefs.map(colDef => node.data[colDef.field!]);
      const row = worksheet.addRow(rowData);

      // 3. Iterate over the cells in the new row
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colDef = this.columnDefs[colNumber - 1];

        // Apply cell styles from colDef
        if (colDef.cellStyle && typeof colDef.cellStyle === 'function') {
          const styleParams = {
            value: cell.value,
            data: node.data,
            node: node,
            colDef: colDef,
            column: this.gridApi.getColumn(colDef.field!)!,
            api: this.gridApi,
            context: this.gridApi.getContext()
          };
          
          const cellStyle = colDef.cellStyle(styleParams);

          if (cellStyle && cellStyle.backgroundColor) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: getARGBFromHex(cellStyle.backgroundColor) }
            };
          }
        }
      });
    });

    // Adjust column widths for better readability
    worksheet.columns.forEach(column => {
        let maxColumnLength = 0;
        if (column && column.values) {
            column.values.forEach(value => {
                const cellValue = value ? String(value) : '';
                maxColumnLength = Math.max(maxColumnLength, cellValue.length);
            });
            column.width = maxColumnLength < 10 ? 10 : maxColumnLength + 2;
        }
    });


    // 4. Generate and Download the Excel file
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'ag-grid-styled-export.xlsx');
    });
  }
}
