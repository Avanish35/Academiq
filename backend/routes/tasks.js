const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Get all tasks for logged in user
router.get('/', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [tasks] = await db.query('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC', [req.user]);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new task
router.post('/', auth, async (req, res) => {
    try {
        const { title, description, priority, scheduled_time, due_date, addToPlanner } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Task title is required' });
        }

        const db = req.app.get('db');
        
        const [result] = await db.query(
            'INSERT INTO tasks (user_id, title, description, priority, scheduled_time, due_date) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user, title.trim(), description || null, priority || 'Medium',
             scheduled_time || null, due_date || null]
        );
        
        const taskId = result.insertId;

        // If user wants to add to weekly planner
        if (addToPlanner && due_date && scheduled_time) {
            const date = new Date(due_date + 'T00:00:00'); // force local parse
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayOfWeek = days[date.getDay()];

            // Calculate end time safely: cap at 23:59:00
            const [h, m] = scheduled_time.split(':').map(Number);
            const endH = Math.min(h + 1, 23);
            const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
            const startTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;

            await db.query(
                'INSERT INTO schedule_blocks (user_id, title, color, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
                [req.user, title.trim(), 'blue', dayOfWeek, startTime, endTime]
            );
        }
        
        res.status(201).json({ id: taskId, title, priority, status: 'To Do' });
    } catch (err) {
        console.error('Task creation error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Update a task
router.put('/:id', auth, async (req, res) => {
    try {
        const { title, description, priority, status, scheduled_time, due_date } = req.body;
        const db = req.app.get('db');
        
        // Ensure user owns the task
        const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user]);
        if (tasks.length === 0) return res.status(404).json({ message: 'Task not found' });

        await db.query(
            'UPDATE tasks SET title = ?, description = ?, priority = ?, status = ?, scheduled_time = ?, due_date = ? WHERE id = ?',
            [title || tasks[0].title, description || tasks[0].description, priority || tasks[0].priority, status || tasks[0].status, scheduled_time || tasks[0].scheduled_time, due_date || tasks[0].due_date, req.params.id]
        );
        
        res.json({ message: 'Task updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a task
router.delete('/:id', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [result] = await db.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user]);
        
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Task not found' });
        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
