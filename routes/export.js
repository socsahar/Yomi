const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const { supabase } = require('../config/database');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'נדרשת הזדהות' });
    }
}

// Helper to get employee name from assignment (handles both regular and manual assignments)
function getEmployeeName(assignment) {
    if (!assignment) return '';
    if (assignment.employees) {
        return `${assignment.employees.first_name} ${assignment.employees.last_name}`;
    }
    if (assignment.manual_employee_name) {
        return assignment.manual_employee_name;
    }
    return '';
}

// Helper to format date in Hebrew
function formatHebrewDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = days[date.getDay()];
    
    return `${dayName} תאריך : ${day}.${month}.${String(year).slice(-2)}`;
}

/**
 * Export schedule to Excel - Building from scratch to match MDA format
 */
router.get('/excel/:scheduleId', requireAuth, async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        
        console.log('===============================================');
        console.log('EXCEL EXPORT STARTED FOR SCHEDULE:', scheduleId);
        console.log('===============================================');
        
        // Get full schedule data with all nested data in ONE query
        const { data: schedule, error: scheduleError } = await supabase
            .from('schedules')
            .select(`
                *,
                shifts (
                    *,
                    units (
                        *,
                        roles (
                            *
                        )
                    )
                )
            `)
            .eq('id', scheduleId)
            .single();
        
        if (scheduleError || !schedule) {
            console.error('Error fetching schedule:', scheduleError);
            return res.status(404).json({ error: 'סידור עבודה לא נמצא' });
        }
        
        // Sort shifts, units, and roles manually
        if (schedule.shifts) {
            // Sort shifts: לילה, בוקר, ערב
            const shiftOrder = { 'לילה': 0, 'בוקר': 1, 'ערב': 2 };
            schedule.shifts.sort((a, b) => (shiftOrder[a.shift_name] || 999) - (shiftOrder[b.shift_name] || 999));
            
            schedule.shifts.forEach(shift => {
                if (shift.units) {
                    shift.units.sort((a, b) => a.unit_order - b.unit_order);
                    shift.units.forEach(unit => {
                        if (unit.roles) {
                            unit.roles.sort((a, b) => a.role_order - b.role_order);
                        }
                    });
                }
            });
        }
        
        // Get all assignments for this schedule in ONE query
        const { data: assignments } = await supabase
            .from('assignments')
            .select(`
                *,
                employees (*)
            `)
            .eq('schedule_id', scheduleId);
        
        // Create a map of role_id -> assignments for quick lookup
        const assignmentsByRole = {};
        assignments?.forEach(assignment => {
            if (!assignmentsByRole[assignment.role_id]) {
                assignmentsByRole[assignment.role_id] = [];
            }
            assignmentsByRole[assignment.role_id].push(assignment);
        });
        
        console.log('Total assignments fetched:', assignments?.length || 0);
        console.log('Assignments by role:', Object.keys(assignmentsByRole).length, 'roles have assignments');
        
        // Create workbook from scratch
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('סידור');
        
        // Set RTL
        worksheet.properties.rightToLeft = true;
        worksheet.properties.defaultRowHeight = 20;
        
        // Set column widths
        worksheet.getColumn(1).width = 9;        // Empty column
        worksheet.getColumn(2).width = 20;       // תחנה
        worksheet.getColumn(3).width = 20;       // משימה לילה
        worksheet.getColumn(4).width = 25;       // שם לילה
        worksheet.getColumn(5).width = 10;       // מספר לילה
        worksheet.getColumn(6).width = 20;       // משימה בוקר
        worksheet.getColumn(7).width = 25;       // שם בוקר
        worksheet.getColumn(8).width = 10;       // מספר בוקר
        worksheet.getColumn(9).width = 20;       // משימה ערב
        worksheet.getColumn(10).width = 25;      // שם ערב
        worksheet.getColumn(11).width = 10;      // מספר ערב
        
        // Title row
        worksheet.mergeCells(1, 2, 1, 11);
        const titleCell = worksheet.getCell(1, 2);
        titleCell.value = `סידור-עבודה כללי : ${formatHebrewDate(schedule.schedule_date)}`;
        titleCell.font = { size: 14, bold: true, name: 'Arial' };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        worksheet.getRow(1).height = 25;
        
        // Shift headers row
        worksheet.getCell(2, 2).value = 'תחנה';
        
        worksheet.mergeCells(2, 3, 2, 5);
        worksheet.getCell(2, 3).value = 'לילה';
        
        worksheet.mergeCells(2, 6, 2, 8);
        worksheet.getCell(2, 6).value = 'בוקר';
        
        worksheet.mergeCells(2, 9, 2, 11);
        worksheet.getCell(2, 9).value = 'ערב';
        
        // Style shift headers
        for (let col = 2; col <= 11; col++) {
            const cell = worksheet.getCell(2, col);
            cell.font = { bold: true, size: 12, name: 'Arial' };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD9D9D9' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }
        worksheet.getRow(2).height = 25;
        
        worksheet.getRow(2).height = 25;
        
        // Build data structure grouped by station
        const shifts = schedule.shifts || [];
        const shiftByName = {};
        shifts.forEach(shift => {
            shiftByName[shift.shift_name] = shift;
        });
        
        // Group all units by station name
        const stationGroups = new Map();
        shifts.forEach(shift => {
            (shift.units || []).forEach(unit => {
                if (!stationGroups.has(unit.unit_name)) {
                    stationGroups.set(unit.unit_name, {
                        stationName: unit.unit_name,
                        shifts: {}
                    });
                }
                const station = stationGroups.get(unit.unit_name);
                if (!station.shifts[shift.shift_name]) {
                    station.shifts[shift.shift_name] = [];
                }
                (unit.roles || []).forEach(role => {
                    station.shifts[shift.shift_name].push({
                        role: role,
                        assignments: assignmentsByRole[role.id] || []
                    });
                });
            });
        });
        
        // Start writing data from row 3
        let currentRow = 3;
        
        for (const [stationName, stationData] of stationGroups) {
            const startRow = currentRow;
            
            // Get max number of roles across all shifts
            let maxRoles = 0;
            ['לילה', 'בוקר', 'ערב'].forEach(shiftName => {
                const roles = stationData.shifts[shiftName] || [];
                maxRoles = Math.max(maxRoles, roles.length);
            });
            
            // Track if ambulance number was added for each shift
            let ambulanceAdded = { 'לילה': false, 'בוקר': false, 'ערב': false };
            
            // Write rows for each role
            for (let roleIdx = 0; roleIdx < maxRoles; roleIdx++) {
                // לילה shift (columns 3-5)
                const lailaRoles = stationData.shifts['לילה'] || [];
                if (roleIdx < lailaRoles.length) {
                    const roleData = lailaRoles[roleIdx];
                    const roleName = roleData.role.role_name;
                    
                    // Check if this is a special merged row
                    const isSpecial = roleName === 'טיוטר' || roleName.includes(':');
                    
                    if (isSpecial) {
                        // Merge cells for טיוטר or time rows
                        worksheet.mergeCells(currentRow, 3, currentRow, 5);
                        worksheet.getCell(currentRow, 3).value = roleName;
                        worksheet.getCell(currentRow, 3).alignment = { horizontal: 'center', vertical: 'middle' };
                    } else {
                        // Regular role - 3 columns: משימה | שם | מספר
                        worksheet.getCell(currentRow, 3).value = roleName;
                        
                        const assignment = roleData.assignments[0];
                        const employeeName = getEmployeeName(assignment);
                        
                        console.log(`Row ${currentRow} - Role: ${roleName}, Assignments:`, roleData.assignments.length, 'Employee:', employeeName || 'NONE');
                        
                        // Get the name cell and set value
                        const nameCell = worksheet.getCell(currentRow, 4);
                        if (employeeName) {
                            nameCell.value = employeeName;
                        }
                        
                        // Add ambulance number only on first regular role
                        if (!ambulanceAdded['לילה'] && roleData.role.ambulance_number) {
                            worksheet.getCell(currentRow, 5).value = roleData.role.ambulance_number;
                            ambulanceAdded['לילה'] = true;
                        }
                        
                        // Style cells
                        worksheet.getCell(currentRow, 3).border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        worksheet.getCell(currentRow, 3).font = { name: 'Arial', size: 10 };
                        worksheet.getCell(currentRow, 3).alignment = { horizontal: 'center', vertical: 'middle' };
                        
                        nameCell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        nameCell.font = { name: 'Arial', size: 10 };
                        nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
                        
                        // Set red fill if no employee
                        if (!employeeName || employeeName.trim() === '') {
                            console.log(`No employee for role ${roleName} at row ${currentRow}, col 4 - applying red fill`);
                            nameCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFF0000' }
                            };
                        }
                        
                        worksheet.getCell(currentRow, 5).border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        worksheet.getCell(currentRow, 5).font = { name: 'Arial', size: 10 };
                        worksheet.getCell(currentRow, 5).alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                }
                
                // בוקר shift (columns 6-8)
                const bokerRoles = stationData.shifts['בוקר'] || [];
                if (roleIdx < bokerRoles.length) {
                    const roleData = bokerRoles[roleIdx];
                    const roleName = roleData.role.role_name;
                    
                    const isSpecial = roleName === 'טיוטר' || roleName.includes(':');
                    
                    if (isSpecial) {
                        worksheet.mergeCells(currentRow, 6, currentRow, 8);
                        worksheet.getCell(currentRow, 6).value = roleName;
                        worksheet.getCell(currentRow, 6).alignment = { horizontal: 'center', vertical: 'middle' };
                    } else {
                        worksheet.getCell(currentRow, 6).value = roleName;
                        
                        const assignment = roleData.assignments[0];
                        const employeeName = getEmployeeName(assignment);
                        
                        // Get the name cell and set value
                        const nameCell = worksheet.getCell(currentRow, 7);
                        if (employeeName) {
                            nameCell.value = employeeName;
                        }
                        
                        if (!ambulanceAdded['בוקר'] && roleData.role.ambulance_number) {
                            worksheet.getCell(currentRow, 8).value = roleData.role.ambulance_number;
                            ambulanceAdded['בוקר'] = true;
                        }
                        
                        // Style cells
                        worksheet.getCell(currentRow, 6).border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        worksheet.getCell(currentRow, 6).font = { name: 'Arial', size: 10 };
                        worksheet.getCell(currentRow, 6).alignment = { horizontal: 'center', vertical: 'middle' };
                        
                        nameCell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        nameCell.font = { name: 'Arial', size: 10 };
                        nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
                        
                        // Set red fill if no employee
                        if (!employeeName || employeeName.trim() === '') {
                            console.log(`No employee for role ${roleName} at row ${currentRow}, col 7 - applying red fill`);
                            nameCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFF0000' }
                            };
                        }
                        
                        worksheet.getCell(currentRow, 8).border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        worksheet.getCell(currentRow, 8).font = { name: 'Arial', size: 10 };
                        worksheet.getCell(currentRow, 8).alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                }
                
                // ערב shift (columns 9-11)
                const erevRoles = stationData.shifts['ערב'] || [];
                if (roleIdx < erevRoles.length) {
                    const roleData = erevRoles[roleIdx];
                    const roleName = roleData.role.role_name;
                    
                    const isSpecial = roleName === 'טיוטר' || roleName.includes(':');
                    
                    if (isSpecial) {
                        worksheet.mergeCells(currentRow, 9, currentRow, 11);
                        worksheet.getCell(currentRow, 9).value = roleName;
                        worksheet.getCell(currentRow, 9).alignment = { horizontal: 'center', vertical: 'middle' };
                    } else {
                        worksheet.getCell(currentRow, 9).value = roleName;
                        
                        const assignment = roleData.assignments[0];
                        const employeeName = getEmployeeName(assignment);
                        
                        // Get the name cell and set value
                        const nameCell = worksheet.getCell(currentRow, 10);
                        if (employeeName) {
                            nameCell.value = employeeName;
                        }
                        
                        if (!ambulanceAdded['ערב'] && roleData.role.ambulance_number) {
                            worksheet.getCell(currentRow, 11).value = roleData.role.ambulance_number;
                            ambulanceAdded['ערב'] = true;
                        }
                        
                        // Style cells
                        worksheet.getCell(currentRow, 9).border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        worksheet.getCell(currentRow, 9).font = { name: 'Arial', size: 10 };
                        worksheet.getCell(currentRow, 9).alignment = { horizontal: 'center', vertical: 'middle' };
                        
                        nameCell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        nameCell.font = { name: 'Arial', size: 10 };
                        nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
                        
                        // Set red fill if no employee
                        if (!employeeName || employeeName.trim() === '') {
                            console.log(`No employee for role ${roleName} at row ${currentRow}, col 10 - applying red fill`);
                            nameCell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFF0000' }
                            };
                        }
                        
                        worksheet.getCell(currentRow, 11).border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        worksheet.getCell(currentRow, 11).font = { name: 'Arial', size: 10 };
                        worksheet.getCell(currentRow, 11).alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                }
                
                currentRow++;
            }
            
            // Merge station name in column 2 for all rows
            if (maxRoles > 1) {
                worksheet.mergeCells(startRow, 2, currentRow - 1, 2);
            }
            const stationCell = worksheet.getCell(startRow, 2);
            stationCell.value = stationName;
            stationCell.font = { bold: true, size: 11, name: 'Arial' };
            stationCell.alignment = { horizontal: 'center', vertical: 'middle' };
            stationCell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }
        
        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sidur-${schedule.schedule_date}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        res.status(500).json({ error: 'שגיאה בייצוא לאקסל' });
    }
});

/**
 * Export schedule to HTML - Beautiful table format
 */
router.get('/html/:scheduleId', requireAuth, async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        
        // Get full schedule data
        const { data: schedule, error: scheduleError } = await supabase
            .from('schedules')
            .select(`
                *,
                shifts (
                    *,
                    units (
                        *,
                        roles (
                            *
                        )
                    )
                )
            `)
            .eq('id', scheduleId)
            .single();
        
        if (scheduleError || !schedule) {
            console.error('Error fetching schedule:', scheduleError);
            return res.status(404).send('<h1>סידור עבודה לא נמצא</h1>');
        }
        
        // Sort shifts: לילה, בוקר, ערב
        const shiftOrder = { 'לילה': 0, 'בוקר': 1, 'ערב': 2 };
        if (schedule.shifts) {
            schedule.shifts.sort((a, b) => (shiftOrder[a.shift_name] || 999) - (shiftOrder[b.shift_name] || 999));
            
            schedule.shifts.forEach(shift => {
                if (shift.units) {
                    shift.units.sort((a, b) => a.unit_order - b.unit_order);
                    shift.units.forEach(unit => {
                        if (unit.roles) {
                            unit.roles.sort((a, b) => a.role_order - b.role_order);
                        }
                    });
                }
            });
        }
        
        // Get all assignments
        const { data: assignments } = await supabase
            .from('assignments')
            .select(`
                *,
                employees (*)
            `)
            .eq('schedule_id', scheduleId);
        
        const assignmentsByRole = {};
        assignments?.forEach(assignment => {
            if (!assignmentsByRole[assignment.role_id]) {
                assignmentsByRole[assignment.role_id] = [];
            }
            assignmentsByRole[assignment.role_id].push(assignment);
        });
        
        // Build station groups
        const shifts = schedule.shifts || [];
        const stationGroups = new Map();
        
        shifts.forEach(shift => {
            (shift.units || []).forEach(unit => {
                if (!stationGroups.has(unit.unit_name)) {
                    stationGroups.set(unit.unit_name, {
                        stationName: unit.unit_name,
                        shifts: {}
                    });
                }
                const station = stationGroups.get(unit.unit_name);
                if (!station.shifts[shift.shift_name]) {
                    station.shifts[shift.shift_name] = [];
                }
                (unit.roles || []).forEach(role => {
                    station.shifts[shift.shift_name].push({
                        role: role,
                        assignments: assignmentsByRole[role.id] || []
                    });
                });
            });
        });
        
        // Generate HTML
        let html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>סידור עבודה - ${formatHebrewDate(schedule.schedule_date)}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            direction: rtl;
        }
        
        .print-button {
            position: fixed;
            top: 20px;
            left: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
        }
        
        .print-button:hover {
            background: #45a049;
        }
        
        .container {
            max-width: 1600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
            font-size: 20px;
            padding: 12px;
            background: white;
            border: 2px solid #333;
            font-weight: bold;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            direction: rtl;
        }
        
        th, td {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            vertical-align: middle;
        }
        
        th {
            background: #d9d9d9;
            font-weight: bold;
            font-size: 12px;
            color: #000;
        }
        
        thead tr:first-child th {
            padding: 10px;
        }
        
        .station-cell {
            background: #f5f5f5;
            font-weight: bold;
            font-size: 14px;
            min-width: 80px;
            max-width: 120px;
            padding: 6px;
        }
        
        .special-row {
            background: #e0e0e0;
            font-weight: bold;
            font-size: 11px;
        }
        
        .role-cell {
            font-size: 12px;
            background: white;
        }
        
        .name-cell {
            font-size: 11px;
            background: white;
        }
        
        .number-cell {
            font-size: 12px;
            font-weight: bold;
            background: white;
        }
        
        .empty-cell {
            background: #000 !important;
            border: 1px solid #000 !important;
        }
        
        .shift-header {
            background: #808080 !important;
            color: white !important;
            font-size: 13px;
            font-weight: bold;
        }
        
        tbody tr:hover {
            background: #f9f9f9;
        }
        
        .station-separator {
            border-bottom: 3px solid #000 !important;
        }
        
        .station-separator td {
            border-bottom: 3px solid #000 !important;
        }
        
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            .print-button {
                display: none;
            }
            
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                padding: 10px;
                max-width: 100%;
            }
            
            @page {
                size: landscape;
                margin: 0.5cm;
            }
            
            h1 {
                font-size: 18px;
                page-break-after: avoid;
            }
            
            table {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <button class="print-button" onclick="window.print()">🖨️ שמור כPDF</button>
    <div class="container">
        <h1>סידור-עבודה כללי : ${formatHebrewDate(schedule.schedule_date)}</h1>
        
        <table>
            <thead>
                <tr>
                    <th rowspan="2" style="background: #808080; color: white;">תחנה</th>
                    <th colspan="3" class="shift-header">לילה</th>
                    <th colspan="3" class="shift-header">בוקר</th>
                    <th colspan="3" class="shift-header">ערב</th>
                </tr>
                <tr>
                    <th style="width: 100px;">משימה</th>
                    <th style="width: 150px;">שם</th>
                    <th style="width: 80px;">אמבולנס</th>
                    <th style="width: 100px;">משימה</th>
                    <th style="width: 150px;">שם</th>
                    <th style="width: 80px;">אמבולנס</th>
                    <th style="width: 100px;">משימה</th>
                    <th style="width: 150px;">שם</th>
                    <th style="width: 80px;">אמבולנס</th>
                </tr>
            </thead>
            <tbody>
`;
        
        // Generate table rows
        for (const [stationName, stationData] of stationGroups) {
            // Get max roles across shifts
            let maxRoles = 0;
            ['לילה', 'בוקר', 'ערב'].forEach(shiftName => {
                const roles = stationData.shifts[shiftName] || [];
                maxRoles = Math.max(maxRoles, roles.length);
            });
            
            // Track ambulance numbers and rowspan positions
            let ambulanceAdded = { 'לילה': false, 'בוקר': false, 'ערב': false };
            let ambulanceRowspan = { 'לילה': { start: -1, end: -1 }, 'בוקר': { start: -1, end: -1 }, 'ערב': { start: -1, end: -1 } };
            
            // Count consecutive crew roles from first crew role (excluding time rows and רגיל תקן)
            const crewRoleCount = { 'לילה': 0, 'בוקר': 0, 'ערב': 0 };
            ['לילה', 'בוקר', 'ערב'].forEach(shiftName => {
                const roles = stationData.shifts[shiftName] || [];
                let counting = false;
                let firstCrewIdx = -1;
                for (let i = 0; i < roles.length; i++) {
                    const r = roles[i];
                    const isTimeRow = r.role.role_name.includes(':') && r.role.role_name.includes('-');
                    const isRegilTaken = r.role.role_name.includes('רגיל תקן');
                    const isCrewRole = !isTimeRow && !isRegilTaken;
                    
                    if (isCrewRole) {
                        if (!counting) {
                            counting = true;
                            firstCrewIdx = i;
                        }
                        crewRoleCount[shiftName]++;
                    } else if (counting) {
                        // Stop counting when we hit a non-crew role after crew roles started
                        break;
                    }
                }
                if (firstCrewIdx >= 0 && crewRoleCount[shiftName] > 0) {
                    ambulanceRowspan[shiftName].start = firstCrewIdx;
                    ambulanceRowspan[shiftName].end = firstCrewIdx + crewRoleCount[shiftName] - 1;
                }
            });
            
            for (let roleIdx = 0; roleIdx < maxRoles; roleIdx++) {
                const isLastRow = roleIdx === maxRoles - 1;
                html += `                <tr${isLastRow ? ' class="station-separator"' : ''}>\n`;
                
                // Station name (rowspan for all roles)
                if (roleIdx === 0) {
                    html += `                    <td rowspan="${maxRoles}" class="station-cell">${stationName}</td>\n`;
                }
                
                // לילה shift
                const lailaRoles = stationData.shifts['לילה'] || [];
                if (roleIdx < lailaRoles.length) {
                    const roleData = lailaRoles[roleIdx];
                    const roleName = roleData.role.role_name;
                    
                    const isTimeRow = roleName.includes(':') && roleName.includes('-');
                    const isRegilTaken = roleName.includes('רגיל תקן');
                    
                    if (isTimeRow) {
                        html += `                    <td colspan="3" class="special-row">${roleName}</td>\n`;
                    } else {
                        html += `                    <td class="role-cell">${roleName}</td>\n`;
                        
                        const assignment = roleData.assignments[0];
                        const employeeName = getEmployeeName(assignment);
                        const redStyle = (!employeeName || employeeName.trim() === '') ? ' style="background-color: red !important;"' : '';
                        html += `                    <td class="name-cell"${redStyle}>${employeeName}</td>\n`;
                        
                        // If this is a רגיל תקן role, it gets its own ambulance cell (always show, not merged)
                        if (isRegilTaken) {
                            const ambulanceNum = roleData.role.ambulance_number || '';
                            html += `                    <td class="number-cell">${ambulanceNum}</td>\n`;
                        }
                        // Add ambulance cell with rowspan on first crew role
                        else if (roleIdx === ambulanceRowspan['לילה'].start && crewRoleCount['לילה'] > 0) {
                            const ambulanceNum = roleData.role.ambulance_number || '';
                            html += `                    <td rowspan="${crewRoleCount['לילה']}" class="number-cell">${ambulanceNum}</td>\n`;
                        }
                        // For crew roles outside the main rowspan (e.g., תגבור after a break), add individual cell
                        else if (roleIdx > ambulanceRowspan['לילה'].end) {
                            const ambulanceNum = roleData.role.ambulance_number || '';
                            html += `                    <td class="number-cell">${ambulanceNum}</td>\n`;
                        }
                        // For crew rows within rowspan range, don't add td (covered by rowspan)
                    }
                } else {
                    html += '                    <td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td>\n';
                }
                
                // בוקר shift
                const bokerRoles = stationData.shifts['בוקר'] || [];
                if (roleIdx < bokerRoles.length) {
                    const roleData = bokerRoles[roleIdx];
                    const roleName = roleData.role.role_name;
                    
                    const isTimeRow = roleName.includes(':') && roleName.includes('-');
                    const isRegilTaken = roleName.includes('רגיל תקן');
                    
                    if (isTimeRow) {
                        html += `                    <td colspan="3" class="special-row">${roleName}</td>\n`;
                    } else {
                        html += `                    <td class="role-cell">${roleName}</td>\n`;
                        
                        const assignment = roleData.assignments[0];
                        const employeeName = getEmployeeName(assignment);
                        const redStyle = (!employeeName || employeeName.trim() === '') ? ' style="background-color: red !important;"' : '';
                        html += `                    <td class="name-cell"${redStyle}>${employeeName}</td>\n`;
                        
                        if (isRegilTaken) {
                            const ambulanceNum = roleData.role.ambulance_number || '';
                            html += `                    <td class="number-cell">${ambulanceNum}</td>\n`;
                        } else if (roleIdx === ambulanceRowspan['בוקר'].start && crewRoleCount['בוקר'] > 0) {
                            const ambulanceNum = roleData.role.ambulance_number || '';
                            html += `                    <td rowspan="${crewRoleCount['בוקר']}" class="number-cell">${ambulanceNum}</td>\n`;
                        } else if (roleIdx > ambulanceRowspan['בוקר'].end) {
                            const ambulanceNum = roleData.role.ambulance_number || '';
                            html += `                    <td class="number-cell">${ambulanceNum}</td>\n`;
                        }
                    }
                } else {
                    html += '                    <td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td>\n';
                }
                
                // ערב shift
                const erevRoles = stationData.shifts['ערב'] || [];
                if (roleIdx < erevRoles.length) {
                    const roleData = erevRoles[roleIdx];
                    const roleName = roleData.role.role_name;
                    
                    const isTimeRow = roleName.includes(':') && roleName.includes('-');
                    const isRegilTaken = roleName.includes('רגיל תקן');
                    
                    if (isTimeRow) {
                        html += `                    <td colspan="3" class="special-row">${roleName}</td>\n`;
                    } else {
                        html += `                    <td class="role-cell">${roleName}</td>\n`;
                        
                        const assignment = roleData.assignments[0];
                        const employeeName = getEmployeeName(assignment);
                        const redStyle = (!employeeName || employeeName.trim() === '') ? ' style="background-color: red !important;"' : '';
                        html += `                    <td class="name-cell"${redStyle}>${employeeName}</td>\n`;
                        
                        if (isRegilTaken) {
                            const ambulanceNum = roleData.role.ambulance_number || '';
                            html += `                    <td class="number-cell">${ambulanceNum}</td>\n`;
                        } else if (roleIdx === ambulanceRowspan['ערב'].start && crewRoleCount['ערב'] > 0) {
                            const ambulanceNum = roleData.role.ambulance_number || '';
                            html += `                    <td rowspan="${crewRoleCount['ערב']}" class="number-cell">${ambulanceNum}</td>\n`;
                        } else if (roleIdx > ambulanceRowspan['ערב'].end) {
                            const ambulanceNum = roleData.role.ambulance_number || '';
                            html += `                    <td class="number-cell">${ambulanceNum}</td>\n`;
                        }
                    }
                } else {
                    html += '                    <td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td>\n';
                }
                
                html += '                </tr>\n';
            }
        }
        
        html += `
            </tbody>
        </table>
`;
        
        // Add notes section if notes exist
        if (schedule.notes && schedule.notes.trim()) {
            console.log('Raw notes from database:', schedule.notes);
            let notes = [];
            try {
                notes = JSON.parse(schedule.notes);
                if (!Array.isArray(notes)) {
                    notes = [schedule.notes];
                }
            } catch (e) {
                console.log('Failed to parse notes as JSON, using as string');
                notes = [schedule.notes];
            }
            
            console.log('Parsed notes array:', notes);
            
            if (notes.length > 0) {
                html += `
        <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border: 2px solid #000; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #000;">הערות:</h3>
            <div style="font-size: 15px; line-height: 1.8;">
`;
                notes.forEach((note, index) => {
                    html += `                <div style="margin-bottom: 5px;">• ${note}</div>\n`;
                });
                html += `
            </div>
        </div>
`;
            }
        } else {
            console.log('No notes found or notes is empty');
        }
        
        // Add extra missions section (משימות מחוץ למשמרת)
        const { data: extraMissions, error: missionsError } = await supabase
            .from('extra_missions')
            .select('*')
            .eq('schedule_id', scheduleId)
            .order('display_order')
            .order('id');
        
        if (!missionsError && extraMissions && extraMissions.length > 0) {
            console.log('Found extra missions:', extraMissions.length);
            html += `
        <div style="margin-top: 30px; page-break-before: auto;">
            <h2 style="text-align: center; margin-bottom: 20px; font-size: 18px; color: #000;">משימות מחוץ למשמרת</h2>
            <table style="width: 100%; border-collapse: collapse; direction: rtl; margin: 0 auto;">
                <thead>
                    <tr style="background: #2196F3;">
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">שעות</th>
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">מיקום</th>
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">רכב</th>
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">שם נהג</th>
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">הערות</th>
                    </tr>
                </thead>
                <tbody>
`;
            extraMissions.forEach((item, index) => {
                const rowClass = index % 2 === 0 ? 'style="background: #e3f2fd;"' : 'style="background: white;"';
                html += `
                    <tr ${rowClass}>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.hours}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.location}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.vehicle || '-'}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.driver_name || '-'}</td>
                        <td style="border: 1px solid #000; padding: 8px;">${item.notes || '-'}</td>
                    </tr>
`;
            });
            html += `
                </tbody>
            </table>
        </div>
`;
        }
        
        // Add extra ambulances section (מעל התקן)
        const { data: extraAmbulances, error: extraError } = await supabase
            .from('extra_ambulances')
            .select('*')
            .eq('schedule_id', scheduleId)
            .order('display_order')
            .order('id');
        
        if (!extraError && extraAmbulances && extraAmbulances.length > 0) {
            console.log('Found extra ambulances:', extraAmbulances.length);
            html += `
        <div style="margin-top: 30px; page-break-before: auto;">
            <h2 style="text-align: center; margin-bottom: 20px; font-size: 18px; color: #000;">מעל התקן</h2>
            <table style="width: 100%; border-collapse: collapse; direction: rtl; margin: 0 auto;">
                <thead>
                    <tr style="background: #ff9800;">
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">שעות</th>
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">תחנה</th>
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">מספר אמבולנס</th>
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">שם נהג</th>
                        <th style="border: 1px solid #000; padding: 10px; color: white; font-weight: bold;">הערות</th>
                    </tr>
                </thead>
                <tbody>
`;
            extraAmbulances.forEach((item, index) => {
                const rowClass = index % 2 === 0 ? 'style="background: #fff3cd;"' : 'style="background: white;"';
                html += `
                    <tr ${rowClass}>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.working_hours}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.station}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.ambulance_number || '-'}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.driver_name || '-'}</td>
                        <td style="border: 1px solid #000; padding: 8px;">${item.notes || '-'}</td>
                    </tr>
`;
            });
            html += `
                </tbody>
            </table>
        </div>
`;
        }
        
        html += `
    </div>
</body>
</html>
`;
        
        // Send HTML directly for browser printing
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
        
    } catch (error) {
        console.error('Error exporting to HTML:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).send(`<h1>שגיאה בייצוא</h1><p>${error.message}</p>`);
    }
});

/**
 * Export schedule to PDF - Matching exact MDA format
 */
router.get('/pdf/:scheduleId', requireAuth, async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        
        // Get full schedule data with all nested data in ONE query
        const { data: schedule, error: scheduleError } = await supabase
            .from('schedules')
            .select(`
                *,
                shifts (
                    *,
                    units (
                        *,
                        roles (
                            *
                        )
                    )
                )
            `)
            .eq('id', scheduleId)
            .single();
        
        if (scheduleError || !schedule) {
            console.error('Error fetching schedule:', scheduleError);
            return res.status(404).json({ error: 'סידור עבודה לא נמצא' });
        }
        
        // Sort shifts, units, and roles manually
        if (schedule.shifts) {
            // Sort shifts: לילה, בוקר, ערב
            const shiftOrder = { 'לילה': 0, 'בוקר': 1, 'ערב': 2 };
            schedule.shifts.sort((a, b) => (shiftOrder[a.shift_name] || 999) - (shiftOrder[b.shift_name] || 999));
            
            schedule.shifts.forEach(shift => {
                if (shift.units) {
                    shift.units.sort((a, b) => a.unit_order - b.unit_order);
                    shift.units.forEach(unit => {
                        if (unit.roles) {
                            unit.roles.sort((a, b) => a.role_order - b.role_order);
                        }
                    });
                }
            });
        }
        
        // Get all assignments for this schedule in ONE query
        const { data: assignments } = await supabase
            .from('assignments')
            .select(`
                *,
                employees (*)
            `)
            .eq('schedule_id', scheduleId);
        
        // Create a map of role_id -> assignments for quick lookup
        const assignmentsByRole = {};
        assignments?.forEach(assignment => {
            if (!assignmentsByRole[assignment.role_id]) {
                assignmentsByRole[assignment.role_id] = [];
            }
            assignmentsByRole[assignment.role_id].push(assignment);
        });

        // Create PDF document
        
        // Create PDF
        const doc = new PDFDocument({ 
            size: 'A4',
            layout: 'portrait',
            margins: { top: 40, bottom: 40, left: 40, right: 40 }
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sidur-${schedule.schedule_date}.pdf`);
        
        doc.pipe(res);
        
        // Title row - matching format
        const pageWidth = doc.page.width - 80; // minus margins
        doc.rect(40, 40, pageWidth, 30)
           .fillAndStroke('#f0f0f0', '#000000');
        
        doc.fillColor('#000000')
           .font('Helvetica-Bold')
           .fontSize(14)
           .text(`סידור-עבודה ${schedule.station} : ${formatHebrewDate(schedule.schedule_date)}`, 40, 50, {
               width: pageWidth,
               align: 'center'
           });
        
        let y = 80;
        const rowHeight = 20;
        const colWidths = [80, 100, 120, 50, 120, 50, 120]; // 7 columns
        
        // Column headers
        const headers = ['תחנה', 'משבצת', 'שם', 'מספר', 'שם', 'מספר', 'שם'];
        let x = 40;
        
        doc.rect(x, y, pageWidth, rowHeight)
           .fillAndStroke('#d9d9d9', '#000000');
        
        doc.fillColor('#000000')
           .font('Helvetica-Bold')
           .fontSize(10);
        
        for (let i = 0; i < headers.length; i++) {
            doc.text(headers[i], x + 5, y + 5, {
                width: colWidths[i] - 10,
                align: 'center'
            });
            x += colWidths[i];
        }
        
        y += rowHeight;
        
        // Process each shift
        const shifts = schedule.shifts || [];
        for (const shift of shifts) {
            const units = shift.units || [];
            
            if (units.length === 0) continue;
            
            // Process each unit
            for (const unit of units) {
                const roles = unit.roles || [];
                
                if (roles.length === 0) continue;
                
                const roleRows = [];
                
                for (const role of roles) {
                    // Get assignments for this role from our map
                    const roleAssignments = assignmentsByRole[role.id] || [];
                    
                    roleRows.push({
                        name: role.role_name,
                        assignments: roleAssignments
                    });
                }
                
                // Create rows for this unit (3 roles)
                const maxRoles = 3;
                const unitStartY = y;
                
                for (let i = 0; i < maxRoles; i++) {
                    const roleData = roleRows[i] || { name: '', assignments: [] };
                    x = 40;
                    
                    // Column A: תחנה (unit name box - gray)
                    if (i === 0) {
                        doc.rect(x, unitStartY, colWidths[0], rowHeight * maxRoles)
                           .fillAndStroke('#d9d9d9', '#000000');
                        
                        doc.fillColor('#000000')
                           .font('Helvetica-Bold')
                           .fontSize(10)
                           .text(unit.unit_name, x + 5, unitStartY + (rowHeight * maxRoles / 2) - 5, {
                               width: colWidths[0] - 10,
                               align: 'center'
                           });
                    }
                    x += colWidths[0];
                    
                    // Column B: משבצת (role name - gray)
                    doc.rect(x, y, colWidths[1], rowHeight)
                       .fillAndStroke('#d9d9d9', '#000000');
                    
                    doc.fillColor('#000000')
                       .font('Helvetica')
                       .fontSize(9)
                       .text(roleData.name, x + 5, y + 5, {
                           width: colWidths[1] - 10,
                           align: 'center'
                       });
                    x += colWidths[1];
                    
                    // Columns C-G: 3 sets of assignments
                    const maxAssignments = 3;
                    let colIdx = 2;
                    
                    for (let j = 0; j < maxAssignments; j++) {
                        const assignment = roleData.assignments[j];
                        const employee = assignment ? assignment.employees : null;
                        
                        if (j < 2) {
                            // Full pair (name + number)
                            // Name
                            doc.rect(x, y, colWidths[colIdx], rowHeight)
                               .fillAndStroke('#ffffff', '#000000');
                            doc.fillColor('#000000')
                               .fontSize(8)
                               .text(employee ? `${employee.first_name} ${employee.last_name}` : '', x + 2, y + 6, {
                                   width: colWidths[colIdx] - 4,
                                   align: 'center'
                               });
                            x += colWidths[colIdx];
                            colIdx++;
                            
                            // Number
                            doc.rect(x, y, colWidths[colIdx], rowHeight)
                               .fillAndStroke('#ffffff', '#000000');
                            doc.fillColor('#000000')
                               .fontSize(8)
                               .text(employee ? (employee.employee_id || '') : '', x + 2, y + 6, {
                                   width: colWidths[colIdx] - 4,
                                   align: 'center'
                               });
                            x += colWidths[colIdx];
                            colIdx++;
                        } else {
                            // Last one: just name
                            doc.rect(x, y, colWidths[colIdx], rowHeight)
                               .fillAndStroke('#ffffff', '#000000');
                            doc.fillColor('#000000')
                               .fontSize(8)
                               .text(employee ? `${employee.first_name} ${employee.last_name}` : '', x + 2, y + 6, {
                                   width: colWidths[colIdx] - 4,
                                   align: 'center'
                               });
                        }
                    }
                    
                    y += rowHeight;
                    
                    // Check if we need a new page
                    if (y > doc.page.height - 100) {
                        doc.addPage();
                        y = 40;
                    }
                }
            }
        }
        
        doc.end();
        
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        res.status(500).json({ error: 'שגיאה בייצוא ל-PDF' });
    }
});

module.exports = router;
