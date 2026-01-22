const express = require('express');
const { supabase } = require('../config/database');

const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'נדרשת הזדהות' });
    }
}

/**
 * Get comprehensive statistics
 */
router.get('/statistics', requireAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Build date filter
        let dateFilter = '';
        const params = [];
        
        if (startDate && endDate) {
            dateFilter = 'WHERE schedule_date BETWEEN $1 AND $2';
            params.push(startDate, endDate);
        } else if (startDate) {
            dateFilter = 'WHERE schedule_date >= $1';
            params.push(startDate);
        } else if (endDate) {
            dateFilter = 'WHERE schedule_date <= $1';
            params.push(endDate);
        }
        
        // Summary statistics - using manual queries
        let summaryData;
        
        // Total schedules
        let schedulesQuery = supabase.from('schedules').select('id', { count: 'exact', head: true });
        
        if (startDate) schedulesQuery = schedulesQuery.gte('schedule_date', startDate);
        if (endDate) schedulesQuery = schedulesQuery.lte('schedule_date', endDate);
        
        const { count: totalSchedules } = await schedulesQuery;
        
        // Total assignments - join with schedules to filter by date
        let assignmentsQuery = supabase
            .from('assignments')
            .select('id, schedules!inner(schedule_date)', { count: 'exact', head: true });
        
        if (startDate) assignmentsQuery = assignmentsQuery.gte('schedules.schedule_date', startDate);
        if (endDate) assignmentsQuery = assignmentsQuery.lte('schedules.schedule_date', endDate);
        
        const { count: totalAssignments } = await assignmentsQuery;
        
        // Unique ambulances - get all roles with ambulance numbers in date range
        let ambulancesQuery = supabase
            .from('roles')
            .select('ambulance_number, units!inner(shifts!inner(schedules!inner(schedule_date)))')
            .not('ambulance_number', 'is', null)
            .neq('ambulance_number', '');
        
        if (startDate) ambulancesQuery = ambulancesQuery.gte('units.shifts.schedules.schedule_date', startDate);
        if (endDate) ambulancesQuery = ambulancesQuery.lte('units.shifts.schedules.schedule_date', endDate);
        
        const { data: ambulances } = await ambulancesQuery;
        const uniqueAmbulances = new Set(ambulances?.map(r => r.ambulance_number).filter(Boolean)).size;
        
        summaryData = {
            totalSchedules: totalSchedules || 0,
            totalAssignments: totalAssignments || 0,
            uniqueAmbulances
        };
        
        // Top employees by assignment count
        let topEmployeesQuery = supabase
            .from('assignments')
            .select(`
                employee_id,
                manual_employee_name,
                role_id,
                employees(first_name, last_name),
                schedules!inner(schedule_date)
            `);
        
        if (startDate) topEmployeesQuery = topEmployeesQuery.gte('schedules.schedule_date', startDate);
        if (endDate) topEmployeesQuery = topEmployeesQuery.lte('schedules.schedule_date', endDate);
        
        const { data: assignments } = await topEmployeesQuery;
        
        // Group by employee
        const employeeMap = {};
        assignments?.forEach(assignment => {
            let employeeKey, employeeName;
            
            if (assignment.employee_id && assignment.employees) {
                employeeKey = `emp_${assignment.employee_id}`;
                employeeName = `${assignment.employees.first_name} ${assignment.employees.last_name}`;
            } else if (assignment.manual_employee_name) {
                employeeKey = `manual_${assignment.manual_employee_name}`;
                employeeName = assignment.manual_employee_name;
            } else {
                return;
            }
            
            if (!employeeMap[employeeKey]) {
                employeeMap[employeeKey] = {
                    employee_name: employeeName,
                    assignment_count: 0,
                    unique_roles: new Set()
                };
            }
            employeeMap[employeeKey].assignment_count++;
            employeeMap[employeeKey].unique_roles.add(assignment.role_id);
        });
        
        const topEmployees = Object.values(employeeMap)
            .map(emp => ({
                employee_name: emp.employee_name,
                assignment_count: emp.assignment_count,
                unique_roles: emp.unique_roles.size
            }))
            .sort((a, b) => b.assignment_count - a.assignment_count)
            .slice(0, 10);
        
        // Station statistics
        let stationQuery = supabase
            .from('schedules')
            .select(`
                station,
                id,
                assignments(id)
            `);
        
        if (startDate) stationQuery = stationQuery.gte('schedule_date', startDate);
        if (endDate) stationQuery = stationQuery.lte('schedule_date', endDate);
        
        const { data: schedules } = await stationQuery;
        
        const stationMap = {};
        schedules?.forEach(schedule => {
            if (!stationMap[schedule.station]) {
                stationMap[schedule.station] = {
                    station: schedule.station,
                    schedule_count: 0,
                    assignment_count: 0
                };
            }
            stationMap[schedule.station].schedule_count++;
            stationMap[schedule.station].assignment_count += schedule.assignments?.length || 0;
        });
        
        const stationStats = Object.values(stationMap)
            .sort((a, b) => b.schedule_count - a.schedule_count);
        
        // Shift statistics
        let shiftsQuery = supabase
            .from('shifts')
            .select(`
                shift_name,
                id,
                schedules!inner(schedule_date),
                units(id, roles(id))
            `);
        
        if (startDate) shiftsQuery = shiftsQuery.gte('schedules.schedule_date', startDate);
        if (endDate) shiftsQuery = shiftsQuery.lte('schedules.schedule_date', endDate);
        
        const { data: shifts } = await shiftsQuery;
        
        const shiftMap = {};
        shifts?.forEach(shift => {
            if (!shiftMap[shift.shift_name]) {
                shiftMap[shift.shift_name] = {
                    shift_name: shift.shift_name,
                    shift_count: 0,
                    unit_count: 0,
                    role_count: 0
                };
            }
            shiftMap[shift.shift_name].shift_count++;
            shiftMap[shift.shift_name].unit_count += shift.units?.length || 0;
            shift.units?.forEach(unit => {
                shiftMap[shift.shift_name].role_count += unit.roles?.length || 0;
            });
        });
        
        const shiftStats = Object.values(shiftMap);
        
        // Recent schedules with counts
        let recentQuery = supabase
            .from('schedules')
            .select(`
                id,
                schedule_date,
                station,
                status,
                shifts(id),
                assignments(id)
            `)
            .order('schedule_date', { ascending: false })
            .limit(10);
        
        if (startDate) recentQuery = recentQuery.gte('schedule_date', startDate);
        if (endDate) recentQuery = recentQuery.lte('schedule_date', endDate);
        
        const { data: recentSchedules } = await recentQuery;
        
        const schedulesWithCounts = recentSchedules?.map(schedule => ({
            id: schedule.id,
            schedule_date: schedule.schedule_date,
            station: schedule.station,
            status: schedule.status,
            shift_count: schedule.shifts?.length || 0,
            assignment_count: schedule.assignments?.length || 0
        }));
        
        res.json({
            summary: summaryData,
            topEmployees,
            stationStats,
            shiftStats,
            recentSchedules: schedulesWithCounts
        });
        
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
    }
});

module.exports = router;
