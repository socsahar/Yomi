# Activity Log & Notifications Feature

## Overview
This feature tracks all user actions in the system and displays them in a dedicated page with real-time notifications.

## What Was Added

### 1. Database Table
- **File**: `add_activity_logs_table.sql`
- **Table**: `activity_logs`
- Tracks: user actions, timestamps, entity types, descriptions, and metadata

### 2. Backend Routes
- **File**: `routes/activity.js`
- **Endpoints**:
  - `GET /api/activity/logs` - Get paginated activity logs
  - `GET /api/activity/recent` - Get recent activities (for notifications)
  - `GET /api/activity/logs/user/:userId` - Get logs for specific user
  - `GET /api/activity/logs/entity/:entityType` - Get logs by entity type

### 3. Frontend Page
- **File**: `public/activity.html` - Activity log page
- **File**: `public/js/activity.js` - Activity log functionality
- Features:
  - Paginated log display
  - Filter by action type and entity type
  - Auto-refresh every 30 seconds
  - Relative timestamps ("2 minutes ago")

### 4. Notification System
- **File**: `public/js/common.js` (updated)
- Features:
  - **Real-time notifications** - Shows immediately when user performs actions
  - **Live toast notifications** in top-right corner
  - Shows username and action
  - Auto-dismisses after 5 seconds
  - Polls for new activities from other users every 10 seconds
  - Doesn't show your own polled actions (only immediate feedback)
  - **Hidden on mobile devices** (screens ≤ 768px width)
  - Click notification to go to activity log page

### 5. Navigation Updates
All HTML pages now have an "יומן פעילות" (Activity Log) link in the navigation menu.

## Setup Instructions

### Step 1: Run Database Migration
Execute the SQL file to create the activity_logs table:

```bash
# If using Supabase, go to SQL Editor and run:
# Content from: add_activity_logs_table.sql
```

Or connect to your database and run:
```sql
psql -U your_user -d your_database -f add_activity_logs_table.sql
```

### Step 2: Restart Server
The server needs to restart to load the new routes:

```bash
npm start
# or
node server.js
```

### Step 3: Test the Feature
1. Log in to the application
2. Perform some actions (create employee, create schedule, etc.)
3. Navigate to "יומן פעילות" in the menu
4. Watch for notifications in the top-right corner

## Activity Types Logged

### Schedules
- ✅ Create schedule (immediate notification)
- ✅ Update schedule (immediate notification for publish)
- ✅ Publish schedule (immediate notification)
- ✅ Delete schedule (can be added)

### Employees
- ✅ Create employee (immediate notification)
- ✅ Update employee (immediate notification)
- ✅ Delete employee (can be added)

### Authentication
- ✅ User login
- ⚪ User logout (can be added)

### Notification Behavior
- **Immediate Feedback**: When YOU perform an action, you see an instant notification
- **Real-time Updates**: When OTHER USERS perform actions, you see notifications within 10 seconds
- **Mobile Friendly**: Notifications are automatically hidden on mobile devices (≤ 768px width)

### Other Actions (Ready to Add)
- Shift assignments
- Extra missions
- Extra ambulances
- Report generation

## How to Add Logging to Other Routes

To log activities in other routes, follow this pattern:

```javascript
// 1. Import the logActivity function
const { logActivity } = require('./activity');

// 2. After a successful operation, call logActivity
await logActivity(
    req.session.userId,           // User ID
    req.session.username,          // Username
    'create',                      // Action type: create, update, delete, publish, etc.
    'employee',                    // Entity type: employee, schedule, shift, etc.
    newEmployee[0].id,            // Entity ID
    `הוסיף עובד חדש: ${first_name} ${last_name}`,  // Description in Hebrew
    { position, station },         // Optional metadata object
    req.ip                        // IP address
);
```

### Example: Add Logging to Delete Employee

```javascript
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        // Get employee details before deletion
        const employee = await select('employees', { where: { id: req.params.id } });
        const employeeName = `${employee[0].first_name} ${employee[0].last_name}`;
        
        await deleteRow('employees', req.params.id);
        
        // Log activity
        const username = req.session.username || 'Unknown';
        await logActivity(
            req.session.userId,
            username,
            'delete',
            'employee',
            req.params.id,
            `מחק עובד: ${employeeName}`,
            null,
            req.ip
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'שגיאה במחיקת עובד' });
    }
});
```

## Customization Options

### Change Notification Poll Interval
In `public/js/common.js`, find:
```javascript
// Poll for new activities every 10 seconds
setInterval(checkForNewActivities, 10000);
```
Change `10000` to your desired interval in milliseconds.

### Change Auto-refresh Interval on Activity Page
In `public/js/activity.js`, find:
```javascript
// Auto-refresh every 30 seconds
setInterval(() => {
    if (currentPage === 1) {
        loadActivityLogs(1);
    }
}, 30000);
```
Change `30000` to your desired interval.

### Change Notification Display Duration
In `public/js/common.js`, find:
```javascript
// Auto remove after 5 seconds
setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
        notification.remove();
        processNotificationQueue();
    }, 300);
}, 5000);
```
Change `5000` to your desired duration in milliseconds.

### Add More Action Types
In `public/js/activity.js` and `public/js/common.js`, update the `getActionText` function:
```javascript
function getActionText(actionType) {
    const actionMap = {
        'create': 'יצר',
        'update': 'עדכן',
        'delete': 'מחק',
        'publish': 'פרסם',
        'login': 'התחבר',
        'export': 'ייצא',     // Add new types here
        'import': 'יבא'
    };
    return actionMap[actionType] || actionType;
}
```

### Add More Entity Types
Update the `getEntityText` function:
```javascript
function getEntityText(entityType) {
    const entityMap = {
        'schedule': 'סידור עבודה',
        'employee': 'עובד',
        'shift': 'משמרת',
        'user': 'משתמש',
        'report': 'דוח',      // Add new types here
        'mission': 'משימה'
    };
    return entityMap[entityType] || entityType;
}
```

## Features to Consider Adding

1. **Export Activity Logs** - Add ability to export logs to Excel/PDF
2. **Advanced Filtering** - Date range filters, search by description
3. **Activity Analytics** - Charts showing most active users, common actions
4. **Email Notifications** - Send email alerts for critical actions
5. **Webhook Integration** - Send activity data to external systems
6. **Undo Functionality** - Allow users to undo recent actions
7. **Activity History Per Entity** - Show history of changes for specific records

## Troubleshooting

### Notifications Not Showing
1. Check browser console for errors
2. Verify `common.js` is loaded on all pages
3. Check if API endpoint `/api/activity/recent` is accessible

### Activity Logs Not Recording
1. Verify database table exists: `SELECT * FROM activity_logs LIMIT 1;`
2. Check server logs for errors
3. Verify `logActivity` is being called with correct parameters
4. Check that `req.session.username` is set during login

### Performance Issues
1. Add indexes to `activity_logs` table (already included in migration)
2. Consider archiving old logs (older than 90 days)
3. Implement server-side filtering instead of client-side
4. Use WebSocket instead of polling for real-time updates

## Database Maintenance

### Archive Old Logs (Example)
```sql
-- Archive logs older than 90 days
CREATE TABLE activity_logs_archive AS 
SELECT * FROM activity_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM activity_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

### View Statistics
```sql
-- Most active users
SELECT username, COUNT(*) as action_count 
FROM activity_logs 
GROUP BY username 
ORDER BY action_count DESC 
LIMIT 10;

-- Actions by type
SELECT action_type, COUNT(*) as count 
FROM activity_logs 
GROUP BY action_type 
ORDER BY count DESC;

-- Recent activity
SELECT username, action_type, entity_type, description, created_at 
FROM activity_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

## Security Considerations

1. **Privacy**: Consider redacting sensitive information from logs
2. **Access Control**: Restrict who can view activity logs (add role-based access)
3. **Data Retention**: Implement automatic log cleanup policy
4. **Audit Trail**: Ensure logs themselves cannot be modified or deleted by users

## Support

For issues or questions about this feature:
1. Check server logs: `npm start` console output
2. Check browser console: F12 -> Console tab
3. Verify database connection and table structure
4. Review the activity.js route file for API issues
