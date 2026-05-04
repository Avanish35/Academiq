const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Get overview stats
router.get('/overview', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        
        const [totalTime] = await db.query(
            'SELECT COALESCE(SUM(duration), 0) as total, COUNT(*) as sessions FROM focus_sessions WHERE user_id = ? AND type = "Focus"',
            [req.user]
        );
        const [tasksDone] = await db.query(
            'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = "Completed"', 
            [req.user]
        );

        // Calculate streak: count consecutive days with at least one focus session
        const [streakRows] = await db.query(
            `SELECT DISTINCT DATE(start_time) as day
             FROM focus_sessions
             WHERE user_id = ? AND type = 'Focus'
             ORDER BY day DESC`,
            [req.user]
        );

        let streak = 0;
        if (streakRows.length > 0) {
            let currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);

            for (const row of streakRows) {
                const rowDate = new Date(row.day);
                rowDate.setHours(0, 0, 0, 0);
                const diffDays = Math.round((currentDate - rowDate) / (1000 * 60 * 60 * 24));
                if (diffDays <= 1) {
                    streak++;
                    currentDate = rowDate;
                } else {
                    break;
                }
            }
        }

        const total = Number(totalTime[0].total) || 0;
        const sessions = Number(totalTime[0].sessions) || 0;

        res.json({
            totalFocusMinutes: total,
            totalSessions: sessions,
            avgSessionMinutes: sessions > 0 ? Math.round(total / sessions) : 0,
            tasksCompleted: Number(tasksDone[0].count) || 0,
            streak: streak
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get productivity trends (last 7 days)
router.get('/trends', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [trends] = await db.query(
            `SELECT DATE_FORMAT(start_time, '%Y-%m-%d') as date,
                    SUM(duration) as minutes,
                    COUNT(*) as sessions
             FROM focus_sessions 
             WHERE user_id = ? AND type = "Focus" AND start_time >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
             GROUP BY DATE(start_time) 
             ORDER BY date ASC`,
            [req.user]
        );
        res.json(trends);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get subject distribution
router.get('/distribution', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [dist] = await db.query(
            `SELECT COALESCE(t.title, 'General') as subject, SUM(fs.duration) as minutes 
             FROM focus_sessions fs 
             LEFT JOIN tasks t ON fs.task_id = t.id 
             WHERE fs.user_id = ? AND fs.type = "Focus" 
             GROUP BY subject 
             ORDER BY minutes DESC`,
            [req.user]
        );
        res.json(dist);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
