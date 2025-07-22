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

  async exportToExcel() {
    if (!this.gridApi) {
      console.error('Grid API not available.');
      return;
    }

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Application Data');

    // 1. Get all displayed columns from the Grid API
    const allColumns = this.gridApi.getAllDisplayedColumns();

    // #region HEADER AND GROUPING LOGIC (This is the new section)
    
    // Create arrays for the two header rows
    const groupHeaderRowData: (string | null)[] = [];
    const childHeaderRowData: (string | null)[] = [];

    allColumns.forEach(column => {
      const colDef = column.getColDef();
      const parent = column.getParent();
      
      // Populate the two header arrays
      groupHeaderRowData.push(parent ? parent.getColDef().headerName || null : colDef.headerName || null);
      childHeaderRowData.push(parent ? colDef.headerName || null : ''); // Child is empty if no parent
    });

    // Add the two header rows to the worksheet
    const groupHeaderRow = worksheet.addRow(groupHeaderRowData);
    const childHeaderRow = worksheet.addRow(childHeaderRowData);

    // Style both header rows
    [groupHeaderRow, childHeaderRow].forEach(headerRow => {
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
    });

    // Merge cells for the group headers
    let mergeFrom = 1;
    for (let i = 1; i <= groupHeaderRowData.length; i++) {
      const currentHeader = groupHeaderRowData[i-1];
      const nextHeader = groupHeaderRowData[i];

      // If the next header is different, or we're at the end, merge the cells
      if (currentHeader !== nextHeader) {
        if (mergeFrom < i) {
          worksheet.mergeCells(1, mergeFrom, 1, i);
        }
        mergeFrom = i + 1;
      }
    }

    // Merge cells for single columns that span two rows (like 'Application Name')
    groupHeaderRow.eachCell((cell, colNumber) => {
        if (!cell.isMerged && childHeaderRow.getCell(colNumber).value === '') {
            worksheet.mergeCells(1, colNumber, 2, colNumber);
        }
    });

    // #endregion

    // #region DATA ROWS AND STYLING (This logic remains the same)

    this.gridApi.forEachNode(node => {
      const rowData = allColumns.map(column => this.gridApi.getValue(column, node));
      const row = worksheet.addRow(rowData);

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const column = allColumns[colNumber - 1];
        if (!column) return;

        const colDef = column.getColDef();
        if (colDef.cellStyle && typeof colDef.cellStyle === 'function') {
          const styleParams = {
            value: cell.value, data: node.data, node: node, colDef: colDef,
            column: column, api: this.gridApi, context: this.gridApi.getContext()
          };
          const cellStyleResult = colDef.cellStyle(styleParams);
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

    // #endregion

    // 6. Adjust column widths
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell!({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 12 ? 12 : maxLength + 2;
    });

    // 7. Generate and Download the Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'application-data-export-grouped.xlsx');
  }
}
