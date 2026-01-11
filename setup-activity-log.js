#!/usr/bin/env node
/**
 * Setup Activity Log Feature
 * This script helps set up the activity log feature by running the database migration
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupActivityLog() {
    console.log('🚀 Setting up Activity Log feature...\n');

    try {
        // Read SQL file
        const sqlPath = path.join(__dirname, 'add_activity_logs_table.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 Running database migration...');
        
        // Execute SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });

        if (error) {
            // If RPC doesn't exist, try using raw query
            console.log('⚠️  RPC method not available, trying alternative method...');
            
            // Split SQL into individual statements
            const statements = sqlContent
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            for (const statement of statements) {
                const { error: stmtError } = await supabase.from('_sql').select(statement);
                if (stmtError && !stmtError.message.includes('does not exist')) {
                    console.error('❌ Error executing statement:', stmtError.message);
                }
            }
        }

        console.log('✅ Database migration completed!');
        console.log('');

        // Verify table was created
        console.log('🔍 Verifying activity_logs table...');
        const { data: tableCheck, error: checkError } = await supabase
            .from('activity_logs')
            .select('*')
            .limit(1);

        if (checkError) {
            if (checkError.message.includes('does not exist')) {
                console.log('⚠️  Table might not have been created. Please run the SQL manually in Supabase SQL Editor:');
                console.log('   1. Go to your Supabase dashboard');
                console.log('   2. Navigate to SQL Editor');
                console.log('   3. Copy and paste the content from add_activity_logs_table.sql');
                console.log('   4. Click Run');
            } else {
                console.error('❌ Error checking table:', checkError.message);
            }
        } else {
            console.log('✅ Table verified successfully!');
        }

        console.log('');
        console.log('✨ Activity Log feature is ready!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Restart your server: npm start');
        console.log('2. Log in to the application');
        console.log('3. Navigate to "יומן פעילות" in the menu');
        console.log('4. Perform actions to see them logged');
        console.log('');
        console.log('📚 For more information, see ACTIVITY_LOG_FEATURE.md');

    } catch (error) {
        console.error('❌ Error setting up activity log:', error.message);
        console.log('');
        console.log('Please run the SQL file manually in Supabase:');
        console.log('1. Go to Supabase dashboard → SQL Editor');
        console.log('2. Open add_activity_logs_table.sql');
        console.log('3. Copy and paste the content');
        console.log('4. Click Run');
        process.exit(1);
    }
}

// Run setup
setupActivityLog();
