const express = require('express');
const router = express.Router();
const { query, insert, update, deleteRow } = require('../config/database');

/**
 * Get all extra ambulances for a schedule
 */
router.get('/:scheduleId/extra-ambulances', async (req, res) => {
    try {
        const { scheduleId } = req.params;
        
        const result = await query(
            'SELECT * FROM extra_ambulances WHERE schedule_id = $1 ORDER BY display_order, id',
            [scheduleId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching extra ambulances:', error);
        res.status(500).json({ error: 'שגיאה בטעינת מעל התקן' });
    }
});

/**
 * Create new extra ambulance
 */
router.post('/:scheduleId/extra-ambulances', async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { working_hours, station, ambulance_number, driver_name, notes } = req.body;
        
        const result = await insert('extra_ambulances', {
            schedule_id: scheduleId,
            working_hours,
            station,
            ambulance_number,
            driver_name,
            notes,
            display_order: 0
        });
        
        res.json(result[0]);
    } catch (error) {
        console.error('Error creating extra ambulance:', error);
        res.status(500).json({ error: 'שגיאה ביצירת מעל התקן' });
    }
});

/**
 * Delete extra ambulance
 */
router.delete('/extra-ambulances/:id', async (req, res) => {
    try {
        await deleteRow('extra_ambulances', req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting extra ambulance:', error);
        res.status(500).json({ error: 'שגיאה במחיקת מעל התקן' });
    }
});

module.exports = router;
