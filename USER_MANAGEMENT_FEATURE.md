# User Management Feature - Setup Guide

## Overview
This feature allows users to create new users with one-time passwords. New users must change their password on first login.

## Database Changes

Run the following SQL to update your database:

```sql
-- Add fields to support one-time password and mandatory password change
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temp_password BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
```

Or run the migration file:
```bash
psql -d your_database < add_user_management_fields.sql
```

## Features Implemented

### 1. User Creation
- Users can create new users by navigating to `/users`
- Click "יצירת משתמש חדש" (Create New User)
- Enter a username (minimum 3 characters)
- System generates a secure 12-character random password

### 2. One-Time Password
- When a user is created, a temporary password is displayed
- The password can be copied to clipboard
- The creator should give this password to the new user
- The password is marked as temporary in the database

### 3. Forced Password Change
- On first login with temporary password, user is redirected to password change page
- User must enter:
  - Current password (the temporary one)
  - New password (minimum 6 characters)
  - Confirm new password
- After successful password change, user can access the system normally

### 4. Password Reset
- Existing users can have their passwords reset
- Click "איפוס סיסמה" (Reset Password) button on user row
- Generates a new temporary password
- User must change password on next login

### 5. User Management
- View all users with their status
- See when users were created and last active
- Delete users (cannot delete yourself)
- Reset passwords for any user

## API Endpoints

### GET /api/users
Get all users (requires authentication)

### POST /api/users
Create new user (requires authentication)
```json
{
  "username": "newuser"
}
```
Returns:
```json
{
  "success": true,
  "user": {
    "id": 123,
    "username": "newuser",
    "temporaryPassword": "Ab1@cd2#Ef3$"
  }
}
```

### DELETE /api/users/:id
Delete user (requires authentication)

### POST /api/users/:id/reset-password
Reset user password (requires authentication)
Returns new temporary password

### POST /api/auth/change-password
Change own password (requires authentication)
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

### POST /api/auth/login (Updated)
Login endpoint now returns `mustChangePassword` flag:
```json
{
  "success": true,
  "mustChangePassword": true,
  "user": {
    "id": 123,
    "username": "user"
  }
}
```

## Files Added/Modified

### New Files:
- `routes/users.js` - User management API routes
- `public/users.html` - User management UI
- `public/js/users.js` - User management frontend logic
- `add_user_management_fields.sql` - Database migration

### Modified Files:
- `database/schema.sql` - Updated users table schema
- `routes/auth.js` - Added password change endpoint and login check
- `public/js/login.js` - Handle password change redirect
- `server.js` - Register users routes
- `public/index.html` - Added users link to navigation
- `public/employees.html` - Added users link to navigation
- `public/schedule.html` - Added users link to navigation
- `public/reports.html` - Added users link to navigation
- `public/activity.html` - Added users link to navigation

## Security Features

1. **Secure Password Generation**: Uses cryptographically secure random generator
2. **Password Hashing**: All passwords are hashed with bcrypt (10 rounds)
3. **Session-based Authentication**: All user management requires valid session
4. **Self-protection**: Users cannot delete themselves
5. **Minimum Password Length**: 6 characters for user-chosen passwords
6. **Forced Password Change**: Temporary passwords must be changed immediately

## Usage Flow

1. **Admin creates user:**
   - Navigate to /users
   - Click "Create New User"
   - Enter username
   - Copy the generated password

2. **Admin gives credentials to new user:**
   - Share username and temporary password

3. **New user logs in:**
   - Goes to /login
   - Enters username and temporary password
   - Automatically redirected to password change page
   - Must set new password before accessing system

4. **Password reset (if needed):**
   - Admin navigates to /users
   - Clicks "Reset Password" for user
   - Copies new temporary password
   - Gives it to the user
   - User must change password on next login

## Testing

1. Start the server: `node server.js`
2. Run database migration: `psql -d your_database < add_user_management_fields.sql`
3. Login with existing admin account
4. Navigate to /users
5. Create a test user
6. Logout and login with test user credentials
7. Verify password change is required
8. Change password and verify normal access

## Notes

- All text is in Hebrew (RTL support)
- Responsive design for mobile devices
- Activity logging for all user management actions
- Temporary passwords are never stored in plain text
