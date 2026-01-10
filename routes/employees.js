const express = require('express');
const { select, insert, update, deleteRow, supabase } = require('../config/database');

const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'נדרשת הזדהות' });
    }
}

/**
 * Get all employees
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const employees = await select('employees', {
            order: { column: 'last_name', ascending: true }
        });
        res.json(employees || []);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'שגיאה בטעינת עובדים' });
    }
});

/**
 * Get single employee
 */
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const employees = await select('employees', {
            where: { id: req.params.id }
        });
        
        if (!employees || employees.length === 0) {
            return res.status(404).json({ error: 'עובד לא נמצא' });
        }
        
        res.json(employees[0]);
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({ error: 'שגיאה בטעינת עובד' });
    }
});

/**
 * Create new employee
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { first_name, last_name, employee_id, phone, email, position, station } = req.body;
        
        // Validation
        if (!first_name || !last_name) {
            return res.status(400).json({ error: 'שם פרטי ושם משפחה נדרשים' });
        }
        
        const newEmployee = await insert('employees', {
            first_name,
            last_name,
            employee_id: employee_id || null,
            phone: phone || null,
            email: email || null,
            position: position || null,
            station: station || null
        });
        
        res.json(newEmployee[0]);
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({ error: 'שגיאה ביצירת עובד' });
    }
});

/**
 * Update employee
 */
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { first_name, last_name, employee_id, phone, email, position, station } = req.body;
        
        const updatedEmployee = await update('employees', req.params.id, {
            first_name,
            last_name,
            employee_id: employee_id || null,
            phone: phone || null,
            email: email || null,
            position: position || null,
            station: station || null,
            updated_at: new Date().toISOString()
        });
        
        res.json(updatedEmployee[0]);
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: 'שגיאה בעדכון עובד' });
    }
});

/**
 * Delete employee
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        await deleteRow('employees', req.params.id);
        res.json({ success: true, message: 'עובד נמחק בהצלחה' });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'שגיאה במחיקת עובד' });
    }
});

/**
 * Bulk import employees from Excel data
 */
router.post('/bulk-import', requireAuth, async (req, res) => {
    try {
        const { employees } = req.body;
        
        if (!employees || !Array.isArray(employees)) {
            return res.status(400).json({ error: 'נתונים לא תקינים' });
        }
        
        // Insert all employees
        const results = [];
        for (const emp of employees) {
            try {
                const newEmployee = await insert('employees', {
                    first_name: emp.first_name,
                    last_name: emp.last_name,
                    employee_id: emp.employee_id,
                    phone: emp.phone,
                    email: emp.email,
                    position: emp.position,
                    station: emp.station
                });
                results.push(newEmployee[0]);
            } catch (error) {
                console.error('Error importing employee:', emp, error);
            }
        }
        
        res.json({
            success: true,
            imported: results.length,
            employees: results
        });
    } catch (error) {
        console.error('Error bulk importing employees:', error);
        res.status(500).json({ error: 'שגיאה בייבוא עובדים' });
    }
});

module.exports = router;
