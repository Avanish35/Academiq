require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Make db accessible to routes
app.set('db', db);

// Routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const habitRoutes = require('./routes/habits');
const focusRoutes = require('./routes/focus');
const analyticsRoutes = require('./routes/analytics');
const scheduleRoutes = require('./routes/schedule');

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/schedule', scheduleRoutes);

// Basic Route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Student Productivity API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Something went wrong!', error: err.message });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
