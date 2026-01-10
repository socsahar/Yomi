const express = require('express');
const bcrypt = require('bcrypt');
const { select, insert } = require('../config/database');

const router = express.Router();
const SALT_ROUNDS = 10;

/**
 * Register new user
 */
router.post('/register', async (req, res) => {
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
router.get('/status', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
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

module.exports = router;
