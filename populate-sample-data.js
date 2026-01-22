// Populate sample assignments to test reports
require('dotenv').config();
const { supabase } = require('./config/database');

async function populateSampleData() {
    try {
        console.log('Populating sample assignments...\n');
        
        // Get the schedule
        const { data: schedule } = await supabase
            .from('schedules')
            .select('id')
            .limit(1)
            .single();
        
        if (!schedule) {
            console.log('No schedule found!');
            return;
        }
        
        console.log('Schedule ID:', schedule.id);
        
        // Get some roles
        const { data: roles } = await supabase
            .from('roles')
            .select('id, role_name, units!inner(unit_name)')
            .limit(10);
        
        console.log(`Found ${roles.length} roles\n`);
        
        // Create sample assignments with manual names
        const sampleEmployees = [
            'יוסי כהן',
            'דני לוי',
            'משה ישראלי',
            'רונית אברהם',
            'שרה דוד'
        ];
        
        let assignmentCount = 0;
        for (let i = 0; i < Math.min(5, roles.length); i++) {
            const employeeName = sampleEmployees[i % sampleEmployees.length];
            
            const { data, error } = await supabase
                .from('assignments')
                .insert({
                    role_id: roles[i].id,
                    schedule_id: schedule.id,
                    manual_employee_name: employeeName
                })
                .select()
                .single();
            
            if (error) {
                console.log(`Error assigning ${employeeName}:`, error.message);
            } else {
                assignmentCount++;
                console.log(`✅ Assigned ${employeeName} to ${roles[i].role_name} in ${roles[i].units.unit_name}`);
            }
        }
        
        console.log(`\n✅ Created ${assignmentCount} sample assignments!`);
        console.log('You can now test the reports page.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

populateSampleData();
