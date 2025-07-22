async exportToExcel() {
    if (!this.gridApi) {
        console.error('Grid API not available.');
        return;
    }

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Application Data');

    const allColumns = this.gridApi.getAllDisplayedColumns();

    // #region HEADER AND GROUPING LOGIC (Corrected)
    
    const groupHeaderRowData: (string | null)[] = [];
    const childHeaderRowData: (string | null)[] = [];

    allColumns.forEach(column => {
        const colDef = column.getColDef();
        // ✅ FIX 1: Access .getParent as a property
        const parent = column.getParent; 
        
        groupHeaderRowData.push(parent ? parent.getColDef().headerName || null : colDef.headerName || null);
        childHeaderRowData.push(parent ? colDef.headerName || null : ''); 
    });

    const groupHeaderRow = worksheet.addRow(groupHeaderRowData);
    const childHeaderRow = worksheet.addRow(childHeaderRowData);

    [groupHeaderRow, childHeaderRow].forEach(headerRow => {
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
    });

    let mergeFrom = 1;
    for (let i = 1; i <= groupHeaderRowData.length; i++) {
        const currentHeader = groupHeaderRowData[i-1];
        const nextHeader = groupHeaderRowData[i];
        if (currentHeader !== nextHeader) {
            if (mergeFrom < i) {
                worksheet.mergeCells(1, mergeFrom, 1, i);
            }
            mergeFrom = i + 1;
        }
    }

    groupHeaderRow.eachCell((cell, colNumber) => {
        if (!cell.isMerged && childHeaderRow.getCell(colNumber).value === '') {
            worksheet.mergeCells(1, colNumber, 2, colNumber);
        }
    });

    // #endregion

    // #region DATA ROWS AND STYLING (Corrected)

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
                
                // ✅ FIX 2: Use bracket notation for 'background-color'
                if (cellStyleResult && cellStyleResult['background-color']) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: getARGBFromHex(cellStyleResult['background-color']) }
                    };
                }
            }
        });
    });

    // #endregion

    // Adjust column widths...
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell!({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) { maxLength = columnLength; }
        });
        column.width = maxLength < 12 ? 12 : maxLength + 2;
    });

    // Generate and Download the Excel file...
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'application-data-export-grouped.xlsx');
}
