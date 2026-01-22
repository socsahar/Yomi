const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { select, insert, update, supabase } = require('../config/database');
const { logActivity } = require('./activity');

const router = express.Router();
const SALT_ROUNDS = 10;

/**
 * Middleware to check authentication
 */
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'נדרשת הזדהות' });
    }
    next();
}

/**
 * Generate a secure random password
 */
function generatePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
        password += charset[randomBytes[i] % charset.length];
    }
    
    return password;
}

/**
 * Get all users
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, created_at, created_by, is_temp_password, must_change_password, last_activity')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ users: users || [] });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'שגיאה בטעינת משתמשים' });
    }
});

/**
 * Create new user with one-time password
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { username } = req.body;
        
        // Validation
        if (!username) {
            return res.status(400).json({ error: 'שם משתמש נדרש' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'שם משתמש חייב להכיל לפחות 3 תווים' });
        }
        
        // Check if username exists
        const existingUser = await select('users', {
            where: { username }
        });
        
        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({ error: 'שם משתמש כבר קיים במערכת' });
        }
        
        // Generate one-time password
        const tempPassword = generatePassword(12);
        const password_hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
        
        // Create user with temporary password flag
        const newUser = await insert('users', {
            username,
            password_hash,
            is_temp_password: true,
            must_change_password: true,
            created_by: req.session.userId
        });
        
        // Log activity
        await logActivity(
            req.session.userId,
            req.session.username,
            'create',
            'user',
            newUser[0].id,
            `נוצר משתמש חדש: ${username}`,
            null,
            req.ip
        );
        
        res.json({
            success: true,
            message: 'משתמש נוצר בהצלחה',
            user: {
                id: newUser[0].id,
                username: newUser[0].username,
                temporaryPassword: tempPassword
            }
        });
        
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'שגיאה ביצירת משתמש' });
    }
});

/**
 * Delete user
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Prevent user from deleting themselves
        if (userId === req.session.userId) {
            return res.status(400).json({ error: 'לא ניתן למחוק את המשתמש שלך' });
        }
        
        // Get user details before deletion
        const users = await select('users', {
            where: { id: userId }
        });
        
        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'משתמש לא נמצא' });
        }
        
        const user = users[0];
        
        // Log activity before deletion
        await logActivity(
            req.session.userId,
            req.session.username,
            'delete',
            'user',
            userId,
            `נמחק משתמש: ${user.username}`,
            null,
            req.ip
        );
        
        // Delete user (activity logs will be preserved with user_id set to NULL if FK is configured correctly)
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);
        
        if (error) {
            console.error('Error deleting user:', error);
            // If FK constraint error, provide more helpful message
            if (error.code === '23503') {
                return res.status(400).json({ 
                    error: 'לא ניתן למחוק משתמש זה. יש להריץ את קובץ ההגדרות fix_activity_logs_foreign_key.sql תחילה' 
                });
            }
            throw error;
        }
        
        res.json({
            success: true,
            message: 'משתמש נמחק בהצלחה'
        });
        
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'שגיאה במחיקת משתמש' });
    }
});

/**
 * Reset user password (generate new one-time password)
 */
router.post('/:id/reset-password', requireAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Get user details
        const users = await select('users', {
            where: { id: userId }
        });
        
        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'משתמש לא נמצא' });
        }
        
        const user = users[0];
        
        // Generate new temporary password
        const tempPassword = generatePassword(12);
        const password_hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
        
        // Update user with new temporary password
        await update('users', userId, {
            password_hash,
            is_temp_password: true,
            must_change_password: true
        });
        
        // Log activity
        await logActivity(
            req.session.userId,
            req.session.username,
            'update',
            'user',
            userId,
            `אופסה סיסמה למשתמש: ${user.username}`,
            null,
            req.ip
        );
        
        res.json({
            success: true,
            message: 'סיסמה אופסה בהצלחה',
            temporaryPassword: tempPassword
        });
        
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'שגיאה באיפוס סיסמה' });
    }
});

module.exports = router;
