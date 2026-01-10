// Script to create admin user in the database
const bcrypt = require('bcrypt');
const { insert, select } = require('../config/database');
require('dotenv').config();

const ADMIN_USERNAME = 'sahar';
const ADMIN_PASSWORD = '240397Sm!';

async function createAdminUser() {
    try {
        console.log('Checking for existing admin user...');
        
        // Check if admin already exists
        const existingUser = await select('users', {
            where: { username: ADMIN_USERNAME }
        });
        
        if (existingUser && existingUser.length > 0) {
            console.log('Admin user already exists!');
            return;
        }
        
        console.log('Creating admin user...');
        
        // Hash password
        const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        
        // Create admin user
        const newUser = await insert('users', {
            username: ADMIN_USERNAME,
            password_hash: password_hash
        });
        
        console.log('Admin user created successfully!');
        console.log(`Username: ${ADMIN_USERNAME}`);
        console.log(`Password: ${ADMIN_PASSWORD}`);
        console.log('\nPlease keep these credentials safe!');
        
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
}

// Run the script
createAdminUser().then(() => {
    console.log('\nSetup complete!');
    process.exit(0);
});
