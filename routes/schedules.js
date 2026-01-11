const express = require('express');
const { select, insert, update, deleteRow, supabase } = require('../config/database');
const { logActivity } = require('./activity');

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
 * Get all schedules with optional filters
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const { date, station } = req.query;
        
        let options = {
            order: { column: 'schedule_date', ascending: false }
        };
        
        if (date || station) {
            options.where = {};
            if (date) options.where.schedule_date = date;
            if (station) options.where.station = station;
        }
        
        const schedules = await select('schedules', options);
        res.json(schedules || []);
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'שגיאה בטעינת סידורי עבודה' });
    }
});

/**
 * Get full schedule with all related data - OPTIMIZED
 */
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const scheduleId = req.params.id;
        
        // Fetch all data in parallel for better performance
        const [schedules, shiftsResult, unitsResult, rolesResult, assignmentsResult] = await Promise.all([
            select('schedules', { where: { id: scheduleId } }),
            supabase.from('shifts')
                .select('*')
                .eq('schedule_id', scheduleId)
                .order('shift_order', { ascending: true }),
            supabase.from('shifts')
                .select('id, units!inner(*)')
                .eq('schedule_id', scheduleId),
            supabase.from('units')
                .select('id, shift_id, roles!inner(*)')
                .eq('shifts.schedule_id', scheduleId)
                .order('shift_id, unit_order'),
            supabase.from('assignments')
                .select('*, employees(*)')
                .eq('schedule_id', scheduleId)
        ]);
        
        if (!schedules || schedules.length === 0) {
            return res.status(404).json({ error: 'סידור עבודה לא נמצא' });
        }
        
        const schedule = schedules[0];
        const { data: shifts, error: shiftsError } = shiftsResult;
        const { data: assignments } = assignmentsResult;
        
        if (shiftsError) throw shiftsError;
        
        // If no shifts yet, return early
        if (!shifts || shifts.length === 0) {
            schedule.shifts = [];
            return res.json(schedule);
        }
        
        // Fetch all units and roles for all shifts in batch
        const shiftIds = shifts.map(s => s.id);
        
        const [allUnitsResult, allRolesResult] = await Promise.all([
            supabase.from('units')
                .select('*')
                .in('shift_id', shiftIds)
                .order('shift_id, unit_order'),
            supabase.from('roles')
                .select('*, units!inner(shift_id)')
                .in('units.shift_id', shiftIds)
                .order('unit_id, role_order')
        ]);
        
        const { data: allUnits } = allUnitsResult;
        const { data: allRoles } = allRolesResult;
        
        // Create lookup maps for efficient grouping
        const assignmentsByRoleId = {};
        if (assignments) {
            assignments.forEach(assignment => {
                assignmentsByRoleId[assignment.role_id] = assignment;
            });
        }
        
        const rolesByUnitId = {};
        if (allRoles) {
            allRoles.forEach(role => {
                if (!rolesByUnitId[role.unit_id]) {
                    rolesByUnitId[role.unit_id] = [];
                }
                // Attach assignment to role
                role.assignment = assignmentsByRoleId[role.id] || null;
                rolesByUnitId[role.unit_id].push(role);
            });
        }
        
        const unitsByShiftId = {};
        if (allUnits) {
            allUnits.forEach(unit => {
                if (!unitsByShiftId[unit.shift_id]) {
                    unitsByShiftId[unit.shift_id] = [];
                }
                // Attach roles to unit
                unit.roles = rolesByUnitId[unit.id] || [];
                unitsByShiftId[unit.shift_id].push(unit);
            });
        }
        
        // Attach units to shifts
        shifts.forEach(shift => {
            shift.units = unitsByShiftId[shift.id] || [];
        });
        
        // Sort shifts: לילה, בוקר, ערב
        const shiftOrder = { 'לילה': 0, 'בוקר': 1, 'ערב': 2 };
        shifts.sort((a, b) => (shiftOrder[a.shift_name] || 999) - (shiftOrder[b.shift_name] || 999));
        
        schedule.shifts = shifts;
        
        res.json(schedule);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'שגיאה בטעינת סידור עבודה' });
    }
});

/**
 * Create new schedule
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { schedule_date, station, shifts } = req.body;
        
        // Validation
        if (!schedule_date) {
            return res.status(400).json({ error: 'תאריך נדרש' });
        }
        
        // Use 'כללי' as default station if not provided
        const stationValue = station || 'כללי';
        
        // Create schedule
        const newSchedule = await insert('schedules', {
            schedule_date,
            station: stationValue,
            status: 'draft',
            created_by: req.session.userId
        });
        
        const scheduleId = newSchedule[0].id;
        
        // Create shifts if provided - optimized with batch inserts
        if (shifts && Array.isArray(shifts)) {
            // Batch insert all shifts at once
            const shiftsToInsert = shifts.map((shift, i) => ({
                schedule_id: scheduleId,
                shift_name: shift.shift_name,
                shift_order: i,
                start_time: shift.start_time,
                end_time: shift.end_time
            }));
            
            const newShifts = await insert('shifts', shiftsToInsert);
            
            // Prepare batch inserts for units and roles
            const allUnits = [];
            const unitIndexMap = []; // Maps [shiftIndex, unitIndex] -> unit data for roles later
            
            newShifts.forEach((newShift, shiftIndex) => {
                const shift = shifts[shiftIndex];
                if (shift.units && Array.isArray(shift.units)) {
                    shift.units.forEach((unit, unitIndex) => {
                        allUnits.push({
                            shift_id: newShift.id,
                            unit_name: unit.unit_name,
                            unit_type: unit.unit_type,
                            unit_order: unitIndex
                        });
                        unitIndexMap.push({
                            shiftIndex,
                            unitIndex,
                            roles: unit.roles
                        });
                    });
                }
            });
            
            // Batch insert all units
            if (allUnits.length > 0) {
                const newUnits = await insert('units', allUnits);
                
                // Prepare batch insert for roles
                const allRoles = [];
                newUnits.forEach((newUnit, index) => {
                    const unitData = unitIndexMap[index];
                    if (unitData.roles && Array.isArray(unitData.roles)) {
                        unitData.roles.forEach((role, roleIndex) => {
                            allRoles.push({
                                unit_id: newUnit.id,
                                role_name: role.role_name,
                                role_order: roleIndex
                            });
                        });
                    }
                });
                
                // Batch insert all roles
                if (allRoles.length > 0) {
                    await insert('roles', allRoles);
                }
            }
        }
        
        // Log activity
        const username = req.session.username || 'Unknown';
        await logActivity(
            req.session.userId,
            username,
            'create',
            'schedule',
            scheduleId,
            `יצר סידור עבודה חדש לתאריך ${schedule_date} בתחנה ${stationValue}`,
            { station: stationValue, date: schedule_date },
            req.ip
        );
        
        res.json(newSchedule[0]);
    } catch (error) {
        console.error('Error creating schedule:', error);
        
        // Check for duplicate key error
        if (error.code === '23505') {
            return res.status(409).json({ error: 'סידור עבודה לתאריך זה כבר קיים במערכת' });
        }
        
        res.status(500).json({ error: 'שגיאה ביצירת סידור עבודה' });
    }
});

/**
 * Update schedule
 */
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { schedule_date, station, status, notes } = req.body;
        
        const updatedSchedule = await update('schedules', req.params.id, {
            schedule_date,
            station,
            status,
            notes,
            updated_at: new Date().toISOString()
        });
        
        // Log activity
        const username = req.session.username || 'Unknown';
        const actionDescription = status === 'published' 
            ? `פרסם סידור עבודה לתאריך ${schedule_date}`
            : `עדכן סידור עבודה לתאריך ${schedule_date}`;
        
        await logActivity(
            req.session.userId,
            username,
            status === 'published' ? 'publish' : 'update',
            'schedule',
            req.params.id,
            actionDescription,
            { station, status, date: schedule_date },
            req.ip
        );
        
        res.json(updatedSchedule[0]);
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ error: 'שגיאה בעדכון סידור עבודה' });
    }
});

/**
 * Delete schedule
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        await deleteRow('schedules', req.params.id);
        res.json({ success: true, message: 'סידור עבודה נמחק בהצלחה' });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ error: 'שגיאה במחיקת סידור עבודה' });
    }
});

/**
 * Add shift to schedule
 */
router.post('/:id/shifts', requireAuth, async (req, res) => {
    try {
        const { shift_name, start_time, end_time, shift_order } = req.body;
        
        const newShift = await insert('shifts', {
            schedule_id: req.params.id,
            shift_name,
            start_time,
            end_time,
            shift_order: shift_order || 0
        });
        
        res.json(newShift[0]);
    } catch (error) {
        console.error('Error adding shift:', error);
        res.status(500).json({ error: 'שגיאה בהוספת משמרת' });
    }
});

/**
 * Add unit to shift
 */
router.post('/shifts/:shiftId/units', requireAuth, async (req, res) => {
    try {
        const { unit_name, unit_type, unit_order } = req.body;
        
        const newUnit = await insert('units', {
            shift_id: req.params.shiftId,
            unit_name,
            unit_type,
            unit_order: unit_order || 0
        });
        
        res.json(newUnit[0]);
    } catch (error) {
        console.error('Error adding unit:', error);
        res.status(500).json({ error: 'שגיאה בהוספת יחידה' });
    }
});

/**
 * Add role to unit
 */
router.post('/units/:unitId/roles', requireAuth, async (req, res) => {
    try {
        const { role_name, role_order } = req.body;
        
        const newRole = await insert('roles', {
            unit_id: req.params.unitId,
            role_name,
            role_order: role_order || 0
        });
        
        res.json(newRole[0]);
    } catch (error) {
        console.error('Error adding role:', error);
        res.status(500).json({ error: 'שגיאה בהוספת תפקיד' });
    }
});

/**
 * Assign employee to role
 */
router.post('/assignments', requireAuth, async (req, res) => {
    try {
        const { role_id, employee_id, manual_employee_name, schedule_id } = req.body;
        
        if (!role_id || !schedule_id) {
            return res.status(400).json({ error: 'נתונים חסרים' });
        }
        
        // Either employee_id or manual_employee_name must be provided
        if (!employee_id && !manual_employee_name) {
            return res.status(400).json({ error: 'נדרש מזהה עובד או שם עובד ידני' });
        }
        
        // Check if assignment already exists
        const existing = await select('assignments', {
            where: { role_id, schedule_id }
        });
        
        if (existing && existing.length > 0) {
            // Update existing assignment
            const updateData = {
                employee_id: employee_id || null,
                manual_employee_name: manual_employee_name || null
            };
            
            const updated = await update('assignments', existing[0].id, updateData);
            return res.json(updated[0]);
        }
        
        // Create new assignment with upsert to handle race conditions
        try {
            const assignmentData = {
                role_id,
                schedule_id,
                employee_id: employee_id || null,
                manual_employee_name: manual_employee_name || null
            };
            
            const newAssignment = await insert('assignments', assignmentData);
            res.json(newAssignment[0]);
        } catch (insertError) {
            // If insert fails due to duplicate, try to update
            if (insertError.code === '23505') {
                console.log('Duplicate detected, updating instead...');
                const existing = await select('assignments', {
                    where: { role_id, schedule_id }
                });
                
                if (existing && existing.length > 0) {
                    const updateData = {
                        employee_id: employee_id || null,
                        manual_employee_name: manual_employee_name || null
                    };
                    const updated = await update('assignments', existing[0].id, updateData);
                    return res.json(updated[0]);
                }
            }
            throw insertError;
        }
        
    } catch (error) {
        console.error('Error assigning employee:', error);
        res.status(500).json({ error: 'שגיאה בשיבוץ עובד' });
    }
});

/**
 * Remove assignment
 */
router.delete('/assignments/:id', requireAuth, async (req, res) => {
    try {
        await deleteRow('assignments', req.params.id);
        res.json({ success: true, message: 'שיבוץ הוסר בהצלחה' });
    } catch (error) {
        console.error('Error removing assignment:', error);
        res.status(500).json({ error: 'שגיאה בהסרת שיבוץ' });
    }
});

/**
 * Delete shift
 */
router.delete('/shifts/:id', requireAuth, async (req, res) => {
    try {
        await deleteRow('shifts', req.params.id);
        res.json({ success: true, message: 'משמרת נמחקה בהצלחה' });
    } catch (error) {
        console.error('Error deleting shift:', error);
        res.status(500).json({ error: 'שגיאה במחיקת משמרת' });
    }
});

/**
 * Update unit
 */
router.put('/units/:id', requireAuth, async (req, res) => {
    try {
        const { ambulance_number } = req.body;
        
        const updatedUnit = await update('units', req.params.id, {
            ambulance_number
        });
        
        res.json(updatedUnit[0]);
    } catch (error) {
        console.error('Error updating unit:', error);
        res.status(500).json({ error: 'שגיאה בעדכון יחידה' });
    }
});

/**
 * Delete unit
 */
router.delete('/units/:id', requireAuth, async (req, res) => {
    try {
        await deleteRow('units', req.params.id);
        res.json({ success: true, message: 'יחידה נמחקה בהצלחה' });
    } catch (error) {
        console.error('Error deleting unit:', error);
        res.status(500).json({ error: 'שגיאה במחיקת יחידה' });
    }
});

/**
 * Update role
 */
router.put('/roles/:id', requireAuth, async (req, res) => {
    try {
        const { role_name, ambulance_number } = req.body;
        
        const updateData = {};
        if (role_name !== undefined) updateData.role_name = role_name;
        if (ambulance_number !== undefined) updateData.ambulance_number = ambulance_number;
        
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'לא סופקו נתונים לעדכון' });
        }
        
        // If updating ambulance_number, check if this is an אטן unit and update all roles
        if (ambulance_number !== undefined) {
            // Get the role to find its unit
            const { data: roleData, error: roleError } = await supabase
                .from('roles')
                .select('unit_id, units!inner(unit_type)')
                .eq('id', req.params.id)
                .single();
            
            if (roleError) throw roleError;
            
            // If this is an אטן unit, update all roles in the same unit
            if (roleData?.units?.unit_type === 'אטן') {
                const { error: bulkUpdateError } = await supabase
                    .from('roles')
                    .update({ ambulance_number })
                    .eq('unit_id', roleData.unit_id);
                
                if (bulkUpdateError) throw bulkUpdateError;
                
                // Return all updated roles
                const { data: updatedRoles, error: fetchError } = await supabase
                    .from('roles')
                    .select('*')
                    .eq('unit_id', roleData.unit_id);
                
                if (fetchError) throw fetchError;
                return res.json(updatedRoles);
            }
        }
        
        const updatedRole = await update('roles', req.params.id, updateData);
        
        res.json(updatedRole[0]);
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'שגיאה בעדכון תפקיד' });
    }
});

/**
 * Delete role
 */
router.delete('/roles/:id', requireAuth, async (req, res) => {
    try {
        await deleteRow('roles', req.params.id);
        res.json({ success: true, message: 'תפקיד נמחק בהצלחה' });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ error: 'שגיאה במחיקת תפקיד' });
    }
});

/**
 * Get all extra missions for a schedule
 */
router.get('/:scheduleId/extra-missions', requireAuth, async (req, res) => {
    try {
        const { scheduleId } = req.params;
        
        const result = await supabase
            .from('extra_missions')
            .select('*')
            .eq('schedule_id', scheduleId)
            .order('display_order')
            .order('id');
        
        if (result.error) throw result.error;
        
        res.json(result.data || []);
    } catch (error) {
        console.error('Error fetching extra missions:', error);
        res.status(500).json({ error: 'שגיאה בטעינת משימות נוספות' });
    }
});

/**
 * Create new extra mission
 */
router.post('/:scheduleId/extra-missions', requireAuth, async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { hours, location, vehicle, driver_name, notes } = req.body;
        
        const result = await insert('extra_missions', {
            schedule_id: scheduleId,
            hours,
            location,
            vehicle,
            driver_name,
            notes,
            display_order: 0
        });
        
        res.json(result[0]);
    } catch (error) {
        console.error('Error creating extra mission:', error);
        res.status(500).json({ error: 'שגיאה ביצירת משימה נוספת' });
    }
});

/**
 * Update extra mission
 */
router.put('/extra-missions/:id', requireAuth, async (req, res) => {
    try {
        const { hours, location, vehicle, driver_name, notes } = req.body;
        
        const result = await update('extra_missions', req.params.id, {
            hours,
            location,
            vehicle,
            driver_name,
            notes,
            updated_at: new Date().toISOString()
        });
        
        res.json(result[0]);
    } catch (error) {
        console.error('Error updating extra mission:', error);
        res.status(500).json({ error: 'שגיאה בעדכון משימה נוספת' });
    }
});

/**
 * Delete extra mission
 */
router.delete('/extra-missions/:id', requireAuth, async (req, res) => {
    try {
        await deleteRow('extra_missions', req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting extra mission:', error);
        res.status(500).json({ error: 'שגיאה במחיקת משימה נוספת' });
    }
});

/**
 * Get all extra ambulances for a schedule
 */
router.get('/:scheduleId/extra-ambulances', requireAuth, async (req, res) => {
    try {
        const { scheduleId } = req.params;
        
        const result = await supabase
            .from('extra_ambulances')
            .select('*')
            .eq('schedule_id', scheduleId)
            .order('display_order')
            .order('id');
        
        if (result.error) throw result.error;
        
        res.json(result.data || []);
    } catch (error) {
        console.error('Error fetching extra ambulances:', error);
        res.status(500).json({ error: 'שגיאה בטעינת מעל התקן' });
    }
});

/**
 * Create new extra ambulance
 */
router.post('/:scheduleId/extra-ambulances', requireAuth, async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { working_hours, station, ambulance_number, driver_name, notes } = req.body;
        
        const result = await insert('extra_ambulances', {
            schedule_id: scheduleId,
            working_hours,
            station,
            ambulance_number,
            driver_name,
            notes,
            display_order: 0
        });
        
        res.json(result[0]);
    } catch (error) {
        console.error('Error creating extra ambulance:', error);
        res.status(500).json({ error: 'שגיאה ביצירת מעל התקן' });
    }
});

/**
 * Update extra ambulance
 */
router.put('/extra-ambulances/:id', requireAuth, async (req, res) => {
    try {
        const { working_hours, station, ambulance_number, driver_name, notes } = req.body;
        
        const result = await update('extra_ambulances', req.params.id, {
            working_hours,
            station,
            ambulance_number,
            driver_name,
            notes,
            updated_at: new Date().toISOString()
        });
        
        res.json(result[0]);
    } catch (error) {
        console.error('Error updating extra ambulance:', error);
        res.status(500).json({ error: 'שגיאה בעדכון מעל התקן' });
    }
});

/**
 * Delete extra ambulance
 */
router.delete('/extra-ambulances/:id', requireAuth, async (req, res) => {
    try {
        await deleteRow('extra_ambulances', req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting extra ambulance:', error);
        res.status(500).json({ error: 'שגיאה במחיקת מעל התקן' });
    }
});

module.exports = router;
