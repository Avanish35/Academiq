const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Get all habits for user — ordered by sort_order
router.get('/', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [habits] = await db.query(
            'SELECT * FROM habits WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
            [req.user]
        );

        // Get today's completion status using MySQL CURDATE()
        const [logs] = await db.query(
            'SELECT habit_id FROM habit_logs WHERE log_date = CURDATE() AND status = 1',
            []
        );
        const completedIds = logs.map(l => l.habit_id);

        res.json(habits.map(h => ({ ...h, completedToday: completedIds.includes(h.id) })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create habit
router.post('/', auth, async (req, res) => {
    try {
        const { title, frequency } = req.body;
        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Habit title is required' });
        }
        const db = req.app.get('db');

        const [[{ maxOrder }]] = await db.query(
            'SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM habits WHERE user_id = ?',
            [req.user]
        );

        const [result] = await db.query(
            'INSERT INTO habits (user_id, title, frequency, sort_order) VALUES (?, ?, ?, ?)',
            [req.user, title.trim(), frequency || 'Daily', maxOrder + 1]
        );
        res.status(201).json({ id: result.insertId, title: title.trim(), frequency, sort_order: maxOrder + 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reorder habits
router.put('/reorder', auth, async (req, res) => {
    try {
        const { orderedIds } = req.body;
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            return res.status(400).json({ error: 'orderedIds array is required' });
        }
        const db = req.app.get('db');
        const updates = orderedIds.map((id, index) =>
            db.query(
                'UPDATE habits SET sort_order = ? WHERE id = ? AND user_id = ?',
                [index, id, req.user]
            )
        );
        await Promise.all(updates);
        res.json({ message: 'Order saved', count: orderedIds.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle habit completion for today
router.post('/:id/toggle', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const habitId = req.params.id;

        const [habits] = await db.query(
            'SELECT * FROM habits WHERE id = ? AND user_id = ?',
            [habitId, req.user]
        );
        if (habits.length === 0) return res.status(404).json({ message: 'Habit not found' });

        // Check for existing log today using CURDATE()
        const [existing] = await db.query(
            'SELECT * FROM habit_logs WHERE habit_id = ? AND log_date = CURDATE()',
            [habitId]
        );

        if (existing.length > 0) {
            const newStatus = existing[0].status ? 0 : 1;
            await db.query('UPDATE habit_logs SET status = ? WHERE id = ?', [newStatus, existing[0].id]);
            res.json({ message: 'Habit status toggled', completed: !!newStatus });
        } else {
            await db.query(
                'INSERT INTO habit_logs (habit_id, log_date, status) VALUES (?, CURDATE(), 1)',
                [habitId]
            );
            res.json({ message: 'Habit marked as completed', completed: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a habit
router.delete('/:id', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [result] = await db.query(
            'DELETE FROM habits WHERE id = ? AND user_id = ?',
            [req.params.id, req.user]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Habit not found' });
        res.json({ message: 'Habit deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
