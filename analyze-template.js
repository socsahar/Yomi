const ExcelJS = require('exceljs');
const path = require('path');

async function analyzeTemplate(filename) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(__dirname, filename));
    
    console.log(`\n========== ${filename} ==========\n`);
    
    workbook.eachSheet((worksheet, sheetId) => {
        console.log(`Sheet ${sheetId}: ${worksheet.name}`);
        console.log(`RTL: ${worksheet.properties.rightToLeft}\n`);
        
        // Find actual used range
        let maxCol = 0;
        let maxRow = 0;
        
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            maxRow = Math.max(maxRow, rowNumber);
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                maxCol = Math.max(maxCol, colNumber);
            });
        });
        
        console.log(`Actual Used Range: ${maxRow} rows x ${maxCol} columns\n`);
        
        // Read first 15 rows to understand structure
        console.log('First 15 rows:');
        for (let rowNum = 1; rowNum <= Math.min(15, maxRow); rowNum++) {
            const row = worksheet.getRow(rowNum);
            const cells = [];
            
            for (let colNum = 1; colNum <= Math.min(15, maxCol); colNum++) {
                const cell = row.getCell(colNum);
                let value = cell.value;
                
                // Handle merged cells
                if (cell.master && cell.master !== cell) {
                    value = '[MERGED]';
                } else if (value && typeof value === 'object' && value.richText) {
                    value = value.richText.map(t => t.text).join('');
                }
                
                // Truncate long values
                if (value && typeof value === 'string' && value.length > 30) {
                    value = value.substring(0, 27) + '...';
                }
                
                cells.push(value || '');
            }
            
            console.log(`Row ${rowNum}: [${cells.join(' | ')}]`);
        }
        
        // Show merged cells
        console.log('\nMerged Cells (first 20):');
        const merges = Object.keys(worksheet._merges).slice(0, 20);
        merges.forEach(key => {
            console.log(`  ${key}`);
        });
        if (Object.keys(worksheet._merges).length > 20) {
            console.log(`  ... and ${Object.keys(worksheet._merges).length - 20} more`);
        }
        
        // Show column widths (first 15)
        console.log('\nColumn Widths (first 15):');
        for (let i = 0; i < Math.min(15, maxCol); i++) {
            const col = worksheet.getColumn(i + 1);
            if (col.width) {
                console.log(`  Column ${i + 1}: ${col.width}`);
            }
        }
    });
}

async function main() {
    try {
        await analyzeTemplate('sidur.xlsx');
        console.log('\n\n');
        await analyzeTemplate('template.xlsx');
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
