const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Log a focus session
router.post('/log', auth, async (req, res) => {
    try {
        const { task_id, start_time, end_time, duration, type } = req.body;
        const db = req.app.get('db');
        
        const [result] = await db.query(
            'INSERT INTO focus_sessions (user_id, task_id, start_time, end_time, duration, type) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user, task_id, start_time, end_time, duration, type || 'Focus']
        );
        
        res.status(201).json({ id: result.insertId, message: 'Session logged' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get today's sessions
router.get('/today', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [sessions] = await db.query(
            `SELECT fs.*, t.title as task_title 
             FROM focus_sessions fs 
             LEFT JOIN tasks t ON fs.task_id = t.id 
             WHERE fs.user_id = ? AND DATE(fs.start_time) = CURDATE()
             ORDER BY fs.start_time DESC`,
            [req.user]
        );
        
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
