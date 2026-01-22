# Manual Employee Assignment Feature

## Changes Made

### 1. Database Migration
- Created `add_manual_employee_name.sql` to add manual employee assignment support:
  - Added `manual_employee_name` column to `assignments` table
  - Made `employee_id` nullable
  - Added constraint to ensure either `employee_id` or `manual_employee_name` is provided

### 2. Backend Updates

#### routes/schedules.js
- Updated POST `/api/schedules/assignments` endpoint to handle manual employee names
- Now accepts either `employee_id` OR `manual_employee_name` parameter
- Validates that at least one is provided

#### routes/export.js
- Added `getEmployeeName(assignment)` helper function to safely handle both regular and manual assignments
- Updated all Excel export functions (לילה, בוקר, ערב shifts) to use the helper
- Updated all HTML/PDF export functions to use the helper
- Prevents "Cannot read properties of null" errors when exporting schedules with manual assignments

### 3. Frontend Updates (public/js/schedule.js)
- Added new function `manuallyAssignEmployee(roleId)` that:
  - Prompts user for employee name
  - Checks if name matches existing employee (uses regular assignment if found)
  - Creates manual assignment for non-existing employees
  - Displays manual assignments in italic with a tooltip indicator

- Updated `displayRoles()` function to:
  - Handle both regular and manual assignments
  - Display manual assignments with italic styling
  - Show tooltip "שיבוץ ידני (לא מרשימת העובדים)" for manual entries

- Added "שיבוץ ידני" (Manual Assignment) button to each role's actions

## How to Use

1. **Run the migration**: Execute the SQL in `add_manual_employee_name.sql` on your database
2. **Restart the server**: The backend changes will take effect
3. **Manual Assignment**: 
   - Click "שיבוץ ידני" button on any role
   - Enter the employee name
   - If the name matches an existing employee, regular assignment is used
   - If the name doesn't match, a manual assignment is created
   - Manual assignments appear in italic text with a tooltip

## Features
- Manual entries are visually distinct (italic text)
- Tooltip shows it's a manual assignment
- Smart matching: automatically uses regular assignment if employee exists
- Full integration with existing assignment system (remove, edit, etc.)
- Export to Excel/PDF works correctly with manual assignments

## Bug Fixes
- Fixed export functionality to handle manual assignments without crashing
- Added proper null checking for employee objects in export routes
