const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Get overview stats - Highly optimized streak calculation & aggregation
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

        // Optimized Streak Calculation:
        // Step 1: Pre-check if a session exists today or yesterday to instantly filter out inactive users (shortcut path)
        let streak = 0;
        const [latestSession] = await db.query(
            'SELECT MAX(start_time) as latest FROM focus_sessions WHERE user_id = ? AND type = "Focus"',
            [req.user]
        );

        if (latestSession[0] && latestSession[0].latest) {
            const latestDate = new Date(latestSession[0].latest);
            latestDate.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const diffDays = Math.round((today - latestDate) / (1000 * 60 * 60 * 24));

            // Only run detailed consecutive scan if the latest study day was today or yesterday
            if (diffDays <= 1) {
                // Fetch at most the last 120 distinct study days (covers up to 4 months of active consecutive study)
                // This eliminates the N-size memory strain on Node server memory
                const [streakRows] = await db.query(
                    `SELECT DISTINCT DATE(start_time) as day
                     FROM focus_sessions
                     WHERE user_id = ? AND type = 'Focus' AND start_time >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
                     ORDER BY day DESC`,
                    [req.user]
                );

                let currentDate = today;
                if (diffDays === 1) {
                    currentDate = latestDate;
                }

                for (const row of streakRows) {
                    const rowDate = new Date(row.day);
                    rowDate.setHours(0, 0, 0, 0);
                    const gap = Math.round((currentDate - rowDate) / (1000 * 60 * 60 * 24));

                    if (gap === 0) {
                        streak++;
                        // Shift reference window to yesterday
                        currentDate.setDate(currentDate.getDate() - 1);
                    } else if (gap > 0) {
                        // Gaps in consecutive calendar dates break the active streak
                        break;
                    }
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
        console.error('Analytics Overview Error:', err.stack);
        res.status(500).json({ error: 'Failed to retrieve analytics overview. Internal server error.' });
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
