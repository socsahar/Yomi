// Check schedule structure and data
require('dotenv').config();
const { supabase } = require('./config/database');

async function checkScheduleData() {
    try {
        console.log('Checking schedule structure...\n');
        
        // Get the schedule with all related data
        const { data: schedule, error } = await supabase
            .from('schedules')
            .select(`
                *,
                shifts(
                    *,
                    units(
                        *,
                        roles(
                            *
                        )
                    )
                ),
                assignments(
                    *,
                    employees(first_name, last_name)
                )
            `)
            .limit(1)
            .single();
        
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log('Schedule:', {
            id: schedule.id,
            date: schedule.schedule_date,
            station: schedule.station,
            status: schedule.status
        });
        
        console.log('\nShifts:', schedule.shifts?.length || 0);
        schedule.shifts?.forEach((shift, i) => {
            console.log(`\n  Shift ${i+1}: ${shift.shift_name}`);
            console.log(`  Units: ${shift.units?.length || 0}`);
            shift.units?.forEach((unit, j) => {
                console.log(`    Unit ${j+1}: ${unit.unit_name}`);
                console.log(`    Roles: ${unit.roles?.length || 0}`);
                unit.roles?.forEach((role, k) => {
                    console.log(`      Role ${k+1}: ${role.role_name} (Ambulance: ${role.ambulance_number || 'N/A'})`);
                });
            });
        });
        
        console.log('\nAssignments:', schedule.assignments?.length || 0);
        schedule.assignments?.forEach((a, i) => {
            const name = a.employees 
                ? `${a.employees.first_name} ${a.employees.last_name}`
                : a.manual_employee_name || 'Unknown';
            console.log(`  ${i+1}. ${name} (Role ID: ${a.role_id})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkScheduleData();
