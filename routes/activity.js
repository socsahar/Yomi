const express = require('express');
const router = express.Router();
const { supabase, insert, select } = require('../config/database');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Helper function to log activity
async function logActivity(userId, username, actionType, entityType, entityId, description, metadata = null, ipAddress = null) {
    try {
        await insert('activity_logs', {
            user_id: userId,
            username: username,
            action_type: actionType,
            entity_type: entityType,
            entity_id: entityId,
            description: description,
            metadata: metadata,
            ip_address: ipAddress,
            created_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

// Get recent activity logs (with pagination)
router.get('/logs', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        // Get total count
        const { count, error: countError } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true });
        
        if (countError) throw countError;
        const totalCount = count || 0;

        // Get logs with pagination
        const { data: logs, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            logs: logs || [],
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

// Get recent activity logs (for real-time notifications)
router.get('/recent', requireAuth, async (req, res) => {
    try {
        const since = req.query.since; // Timestamp to get logs after
        const limit = parseInt(req.query.limit) || 10;

        let query = supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (since) {
            query = query.gt('created_at', since);
        }

        const { data: logs, error } = await query;

        if (error) throw error;

        res.json({
            logs: logs || []
        });
    } catch (error) {
        console.error('Error fetching recent activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch recent activity logs' });
    }
});

// Get activity logs for a specific user
router.get('/logs/user/:userId', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const { data: logs, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            logs: logs || []
        });
    } catch (error) {
        console.error('Error fetching user activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch user activity logs' });
    }
});

// Get activity logs by entity type
router.get('/logs/entity/:entityType', requireAuth, async (req, res) => {
    try {
        const { entityType } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const { data: logs, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('entity_type', entityType)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            logs: logs || []
        });
    } catch (error) {
        console.error('Error fetching entity activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch entity activity logs' });
    }
});

// Export logActivity helper for use in other routes
module.exports = router;
module.exports.logActivity = logActivity;
