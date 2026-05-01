const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Get all schedule blocks
router.get('/', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [blocks] = await db.query(
            'SELECT * FROM schedule_blocks WHERE user_id = ? ORDER BY day_of_week, start_time',
            [req.user]
        );
        res.json(blocks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a schedule block
router.post('/', auth, async (req, res) => {
    try {
        const { title, color, day_of_week, start_time, end_time, is_important } = req.body;
        if (!title || !day_of_week || !start_time) {
            return res.status(400).json({ error: 'title, day_of_week and start_time are required' });
        }
        const db = req.app.get('db');
        const [result] = await db.query(
            'INSERT INTO schedule_blocks (user_id, title, color, day_of_week, start_time, end_time, is_important) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user, title.trim(), color || 'blue', day_of_week, start_time,
             end_time || null, is_important ? 1 : 0]
        );
        res.status(201).json({ id: result.insertId, title, day_of_week, color, is_important: !!is_important });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a block (move day, change time, toggle important, rename)
router.put('/:id', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [rows] = await db.query(
            'SELECT * FROM schedule_blocks WHERE id = ? AND user_id = ?',
            [req.params.id, req.user]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Block not found' });

        const existing = rows[0];
        const {
            title      = existing.title,
            color      = existing.color,
            day_of_week = existing.day_of_week,
            start_time  = existing.start_time,
            end_time    = existing.end_time,
            is_important = existing.is_important
        } = req.body;

        await db.query(
            `UPDATE schedule_blocks
             SET title=?, color=?, day_of_week=?, start_time=?, end_time=?, is_important=?
             WHERE id=? AND user_id=?`,
            [title, color, day_of_week, start_time, end_time, is_important ? 1 : 0,
             req.params.id, req.user]
        );
        res.json({ message: 'Block updated', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a schedule block
router.delete('/:id', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [result] = await db.query(
            'DELETE FROM schedule_blocks WHERE id = ? AND user_id = ?',
            [req.params.id, req.user]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Block not found' });
        res.json({ message: 'Block deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auto-Schedule Logic (Smart Feature)
router.post('/auto', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [tasks] = await db.query(
            'SELECT * FROM tasks WHERE user_id = ? AND status = "To Do"', [req.user]
        );
        const [existing] = await db.query(
            'SELECT * FROM schedule_blocks WHERE user_id = ?', [req.user]
        );

        const days  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const slots = ['09:00:00', '10:00:00', '11:00:00', '14:00:00', '15:00:00'];
        const newBlocks = [];
        let taskIndex = 0;

        for (const day of days) {
            for (const slot of slots) {
                if (taskIndex >= tasks.length) break;
                const isTaken = existing.some(b => b.day_of_week === day && b.start_time === slot);
                if (!isTaken) {
                    const task = tasks[taskIndex];
                    const [h, m] = slot.split(':').map(Number);
                    const totalMins = h * 60 + m + 50;
                    const endH = Math.floor(totalMins / 60).toString().padStart(2, '0');
                    const endM = (totalMins % 60).toString().padStart(2, '0');
                    const endTime = `${endH}:${endM}:00`;

                    const [result] = await db.query(
                        'INSERT INTO schedule_blocks (user_id, title, color, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
                        [req.user, task.title, 'purple', day, slot, endTime]
                    );
                    newBlocks.push({ id: result.insertId, title: task.title, day_of_week: day });
                    taskIndex++;
                }
            }
        }

        res.json({ message: `Successfully scheduled ${newBlocks.length} tasks`, blocks: newBlocks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
