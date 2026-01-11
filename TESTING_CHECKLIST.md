# Testing Checklist for Live Notifications

## Prerequisites
✅ Database migration `add_activity_logs_table.sql` has been run
✅ Server is running (`node server.js`)
✅ Browser cache cleared (Ctrl+Shift+Delete)

## Desktop Testing (Width > 768px)

### Test 1: Employee Creation
1. [ ] Navigate to Employees page
2. [ ] Click "הוסף עובד" (Add Employee)
3. [ ] Fill in employee details
4. [ ] Click save
5. [ ] **Expected**: Notification appears immediately in top-right corner
6. [ ] **Expected**: Notification shows "אתה יצר" (You created)
7. [ ] **Expected**: Notification auto-dismisses after 5 seconds
8. [ ] Navigate to Activity Log page
9. [ ] **Expected**: Action is logged in the activity table

### Test 2: Employee Update
1. [ ] On Employees page, click "ערוך" (Edit) on any employee
2. [ ] Modify some details
3. [ ] Click save
4. [ ] **Expected**: Notification appears immediately
5. [ ] **Expected**: Notification shows "אתה עדכן" (You updated)
6. [ ] Check Activity Log page
7. [ ] **Expected**: Update is logged

### Test 3: Schedule Creation
1. [ ] Navigate to Schedule page
2. [ ] Click "צור סידור חדש" (Create New Schedule)
3. [ ] Select a date
4. [ ] Click create
5. [ ] **Expected**: Notification appears immediately
6. [ ] **Expected**: Notification shows schedule creation
7. [ ] Check Activity Log page
8. [ ] **Expected**: Schedule creation is logged

### Test 4: Multi-User Real-time (if possible)
1. [ ] Open application in two different browsers (or incognito)
2. [ ] Log in as different users in each
3. [ ] In Browser 1, create an employee
4. [ ] **Expected**: Notification appears immediately in Browser 1
5. [ ] **Expected**: Within 10 seconds, notification appears in Browser 2
6. [ ] **Expected**: Browser 2 shows the OTHER user's name, not "אתה"

### Test 5: Click Notification
1. [ ] Perform any action to trigger notification
2. [ ] Click on the notification toast
3. [ ] **Expected**: Redirects to Activity Log page

### Test 6: Multiple Notifications
1. [ ] Perform 3 actions quickly (create 3 employees)
2. [ ] **Expected**: Notifications queue and show one after another
3. [ ] **Expected**: Each notification stays for 5 seconds
4. [ ] **Expected**: No notifications overlap

## Mobile Testing (Width ≤ 768px)

### Test 7: Mobile - No Notifications
1. [ ] Open application on mobile device OR resize browser to < 768px
2. [ ] Perform any action (create employee, schedule, etc.)
3. [ ] **Expected**: NO notification appears
4. [ ] Navigate to Activity Log page
5. [ ] **Expected**: Activity Log page works normally
6. [ ] **Expected**: Actions are still logged in the table

### Test 8: Responsive Resize
1. [ ] Start with desktop view (> 768px)
2. [ ] Create an employee
3. [ ] **Expected**: Notification appears
4. [ ] Resize browser to < 768px
5. [ ] **Expected**: Notification container disappears
6. [ ] Create another employee
7. [ ] **Expected**: No notification appears
8. [ ] Resize back to > 768px
9. [ ] Create another employee
10. [ ] **Expected**: Notification appears again

## Browser Console Testing

### Test 9: Check for Errors
1. [ ] Open browser console (F12)
2. [ ] Perform various actions
3. [ ] **Expected**: No JavaScript errors
4. [ ] **Expected**: No 404 errors for API calls
5. [ ] Check Network tab
6. [ ] **Expected**: `/api/activity/recent` is called every 10 seconds
7. [ ] **Expected**: All POST/PUT requests return 200 status

### Test 10: Function Availability
1. [ ] Open browser console
2. [ ] Type: `typeof showImmediateNotification`
3. [ ] **Expected**: Returns "function"
4. [ ] Type: `showImmediateNotification('create', 'employee', 'Test notification')`
5. [ ] **Expected**: Notification appears (if on desktop)

## Activity Log Page Testing

### Test 11: Activity Log Display
1. [ ] Navigate to Activity Log page
2. [ ] **Expected**: All actions are displayed
3. [ ] **Expected**: Shows username, action type, description
4. [ ] **Expected**: Shows relative time (e.g., "לפני 2 דקות")
5. [ ] Check filters work
6. [ ] **Expected**: Can filter by action type
7. [ ] **Expected**: Can filter by entity type

### Test 12: Auto-refresh
1. [ ] Stay on Activity Log page for 30 seconds
2. [ ] **Expected**: Page auto-refreshes
3. [ ] Perform action in another tab
4. [ ] Wait 30 seconds
5. [ ] **Expected**: New activity appears without manual refresh

## Edge Cases

### Test 13: Long Descriptions
1. [ ] Create employee with very long name (50+ characters)
2. [ ] **Expected**: Notification displays without breaking layout
3. [ ] **Expected**: Text wraps or truncates properly

### Test 14: Rapid Actions
1. [ ] Quickly create 10 employees in succession
2. [ ] **Expected**: All notifications queue properly
3. [ ] **Expected**: No crashes or freezing
4. [ ] **Expected**: All actions logged in database

### Test 15: Session Timeout
1. [ ] Log in
2. [ ] Wait for session to expire (24 hours or manually clear session)
3. [ ] Try to perform action
4. [ ] **Expected**: Redirects to login
5. [ ] **Expected**: No JavaScript errors

## Performance Testing

### Test 16: Polling Performance
1. [ ] Leave application open for 5 minutes
2. [ ] Check Network tab in console
3. [ ] **Expected**: `/api/activity/recent` called every 10 seconds
4. [ ] **Expected**: Response time < 500ms
5. [ ] **Expected**: No memory leaks

### Test 17: Notification Memory
1. [ ] Leave application open
2. [ ] Trigger 50+ notifications over 10 minutes
3. [ ] **Expected**: Notifications properly removed from DOM after dismissal
4. [ ] **Expected**: No memory leaks

## Database Verification

### Test 18: Database Logging
1. [ ] Perform various actions
2. [ ] Check database: `SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 20;`
3. [ ] **Expected**: All actions are logged
4. [ ] **Expected**: user_id is populated
5. [ ] **Expected**: username is populated
6. [ ] **Expected**: action_type is correct
7. [ ] **Expected**: entity_type is correct
8. [ ] **Expected**: description is in Hebrew
9. [ ] **Expected**: created_at is recent

## Troubleshooting Checklist

If notifications don't appear:
- [ ] Check console for JavaScript errors
- [ ] Verify `common.js` is loaded: Check Network tab for 200 status
- [ ] Verify screen width > 768px: `console.log(window.innerWidth)`
- [ ] Check notification container exists: `document.getElementById('notificationContainer')`
- [ ] Check function exists: `typeof showImmediateNotification`
- [ ] Clear browser cache and hard reload (Ctrl+Shift+R)

If activity not logged to database:
- [ ] Verify database table exists: `\dt activity_logs` in psql
- [ ] Check server logs for errors
- [ ] Verify `req.session.userId` is set
- [ ] Check API endpoint responds: Test in Postman
- [ ] Verify database connection is working

## Success Criteria

✅ All 18 tests pass
✅ No console errors
✅ No 404 network errors
✅ Notifications appear on desktop
✅ Notifications hidden on mobile
✅ Activity logged to database
✅ Activity Log page displays correctly
✅ Performance is acceptable
