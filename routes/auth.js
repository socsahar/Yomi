const express = require('express');
const bcrypt = require('bcrypt');
const { select, insert, update, supabase } = require('../config/database');
const { logActivity } = require('./activity');

const router = express.Router();
const SALT_ROUNDS = 10;

/**
 * Register new user (DISABLED - users can only be created by admins through /api/users)
 */
router.post('/register', async (req, res) => {
    return res.status(403).json({ error: 'הרשמה עצמית אינה זמינה. נא ליצור קשר עם מנהל המערכת' });
    
    /* Original registration code disabled
    try {
        const { username, password } = req.body;
        
        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'שם משתמש חייב להכיל לפחות 3 תווים' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'סיסמה חייבת להכיל לפחות 6 תווים' });
        }
        
        // Check if username exists
        const existingUser = await select('users', {
            where: { username }
        });
        
        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({ error: 'שם משתמש כבר קיים במערכת' });
        }
        
        // Hash password
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        
        // Create user
        const newUser = await insert('users', {
            username,
            password_hash
        });
        
        // Set session
        req.session.userId = newUser[0].id;
        req.session.username = newUser[0].username;
        
        res.json({
            success: true,
            message: 'משתמש נוצר בהצלחה',
            user: {
                id: newUser[0].id,
                username: newUser[0].username
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'שגיאה ביצירת משתמש' });
    }
    */
});

/**
 * Login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
        }
        
        // Find user
        const users = await select('users', {
            where: { username }
        });
        
        if (!users || users.length === 0) {
            return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
        }
        
        const user = users[0];
        
        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
        }
        
        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;
        
        // Update last activity
        await update('users', user.id, {
            last_activity: new Date().toISOString()
        });
        
        // Log activity
        await logActivity(
            user.id,
            user.username,
            'login',
            'user',
            user.id,
            'התחבר למערכת',
            null,
            req.ip
        );
        
        // Check if user must change password
        if (user.must_change_password || user.is_temp_password) {
            req.session.mustChangePassword = true;
            return res.json({
                success: true,
                mustChangePassword: true,
                message: 'נדרש לשנות סיסמה',
                user: {
                    id: user.id,
                    username: user.username
                }
            });
        }
        
        // Clear the flag if it was previously set
        req.session.mustChangePassword = false;
        
        res.json({
            success: true,
            message: 'התחברת בהצלחה',
            user: {
                id: user.id,
                username: user.username
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'שגיאה בהתחברות' });
    }
});

/**
 * Logout
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'שגיאה בהתנתקות' });
        }
        res.json({ success: true, message: 'התנתקת בהצלחה' });
    });
});

/**
 * Check authentication status
 */
router.get('/status', async (req, res) => {
    if (req.session.userId) {
        // Update last activity
        try {
            await update('users', req.session.userId, {
                last_activity: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating last activity:', error);
        }
        
        res.json({
            authenticated: true,
            mustChangePassword: req.session.mustChangePassword || false,
            user: {
                id: req.session.userId,
                username: req.session.username
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

/**
 * Get online users (users active in last 1 hour)
 */
router.get('/online-users', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'נדרשת הזדהות' });
    }
    
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, last_activity')
            .gt('last_activity', oneHourAgo)
            .order('username', { ascending: true });
        
        if (error) throw error;
        
        res.json({
            users: users || [],
            count: users ? users.length : 0
        });
    } catch (error) {
        console.error('Error fetching online users:', error);
        res.status(500).json({ error: 'שגיאה בטעינת משתמשים מחוברים' });
    }
});

/**
 * Update user activity (heartbeat)
 */
router.post('/heartbeat', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'נדרשת הזדהות' });
    }
    
    try {
        await update('users', req.session.userId, {
            last_activity: new Date().toISOString()
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating heartbeat:', error);
        res.status(500).json({ error: 'שגיאה בעדכון פעילות' });
    }
});

/**
 * Get Supabase config for realtime features (authenticated users only)
 */
router.get('/supabase-config', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'נדרשת הזדהות' });
    }
    
    res.json({
        url: process.env.SUPABASE_URL,
        // Use service_role key for realtime (full permissions)
        anonKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    });
});

/**
 * Change password (for first-time login or user-initiated change)
 */
router.post('/change-password', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'נדרשת הזדהות' });
    }
    
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'סיסמה נוכחית וסיסמה חדשה נדרשות' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'סיסמה חדשה חייבת להכיל לפחות 6 תווים' });
        }
        
        // Get user
        const users = await select('users', {
            where: { id: req.session.userId }
        });
        
        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'משתמש לא נמצא' });
        }
        
        const user = users[0];
        
        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'סיסמה נוכחית שגויה' });
        }
        
        // Hash new password
        const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        
        // Update password and clear temporary flags
        await update('users', req.session.userId, {
            password_hash,
            is_temp_password: false,
            must_change_password: false
        });
        
        // Clear session flag
        req.session.mustChangePassword = false;
        
        // Log activity
        await logActivity(
            req.session.userId,
            req.session.username,
            'update',
            'user',
            req.session.userId,
            'שינה סיסמה',
            null,
            req.ip
        );
        
        res.json({
            success: true,
            message: 'הסיסמה שונתה בהצלחה'
        });
        
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'שגיאה בשינוי סיסמה' });
    }
});

module.exports = router;
