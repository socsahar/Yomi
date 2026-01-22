// Test script to verify reports data
require('dotenv').config();
const { supabase } = require('./config/database');

async function testReports() {
    try {
        console.log('Testing reports data...\n');
        
        // Test 1: Get schedules count
        const { count: schedulesCount, error: schedError } = await supabase
            .from('schedules')
            .select('id', { count: 'exact', head: true });
        
        console.log('1. Total Schedules:', schedulesCount);
        if (schedError) console.error('  Error:', schedError);
        
        // Test 2: Get assignments count
        const { count: assignmentsCount, error: assignError } = await supabase
            .from('assignments')
            .select('id', { count: 'exact', head: true });
        
        console.log('2. Total Assignments:', assignmentsCount);
        if (assignError) console.error('  Error:', assignError);
        
        // Test 3: Get ambulance numbers
        const { data: ambulances, error: ambError } = await supabase
            .from('roles')
            .select('ambulance_number')
            .not('ambulance_number', 'is', null)
            .neq('ambulance_number', '');
        
        const uniqueAmbulances = new Set(ambulances?.map(r => r.ambulance_number).filter(Boolean)).size;
        console.log('3. Unique Ambulances:', uniqueAmbulances);
        if (ambError) console.error('  Error:', ambError);
        
        // Test 4: Get assignments with employee details
        const { data: assignments, error: empError } = await supabase
            .from('assignments')
            .select('employee_id, manual_employee_name, employees(first_name, last_name)')
            .limit(5);
        
        console.log('\n4. Sample Assignments:');
        assignments?.forEach((a, i) => {
            const name = a.employee_id && a.employees 
                ? `${a.employees.first_name} ${a.employees.last_name}`
                : a.manual_employee_name || 'Unknown';
            console.log(`  ${i+1}. ${name} (ID: ${a.employee_id || 'manual'})`);
        });
        if (empError) console.error('  Error:', empError);
        
        // Test 5: Get schedules with station info
        const { data: schedules, error: stationError } = await supabase
            .from('schedules')
            .select('id, schedule_date, station, status')
            .order('schedule_date', { ascending: false })
            .limit(5);
        
        console.log('\n5. Recent Schedules:');
        schedules?.forEach((s, i) => {
            console.log(`  ${i+1}. ${s.schedule_date} - ${s.station} (${s.status})`);
        });
        if (stationError) console.error('  Error:', stationError);
        
        console.log('\n✅ Test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testReports();
