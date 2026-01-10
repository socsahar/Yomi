const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const scheduleRoutes = require('./routes/schedules');
const exportRoutes = require('./routes/export');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'mda-shift-scheduler-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/reports', reportsRoutes);

// Main page route (BEFORE static files)
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

// Static files (AFTER main route)
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware for protected routes
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'נדרשת הזדהות' });
    }
}

// Protected pages
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/employees', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employees.html'));
});

app.get('/schedule', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

app.get('/reports', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'שגיאת שרת פנימית' });
});

// Start server
app.listen(PORT, () => {
    console.log(`MDA Shift Scheduler running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
