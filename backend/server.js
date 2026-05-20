require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads folders exist for profile photos
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());

// Serve static uploaded files
app.use('/uploads', express.static(uploadsDir));

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

// Test database connection and run schema migrations on startup
db.getConnection()
    .then(async conn => {
        console.log('Successfully connected to the MySQL Database.');
        
        // Auto-migration: Ensure all profile fields exist in the users table
        const columnsToAdd = [
            { name: 'institution', type: 'VARCHAR(255)' },
            { name: 'year', type: 'VARCHAR(50) DEFAULT "Freshman"' },
            { name: 'field', type: 'VARCHAR(255)' },
            { name: 'student_id', type: 'VARCHAR(100)' },
            { name: 'goal', type: 'VARCHAR(255)' },
            { name: 'quote', type: 'TEXT' }
        ];

        for (const col of columnsToAdd) {
            try {
                const [rows] = await conn.query(
                    `SHOW COLUMNS FROM users LIKE ?`, [col.name]
                );
                if (rows.length === 0) {
                    await conn.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
                    console.log(`Migration: Added missing column [${col.name}] to users table.`);
                }
            } catch (err) {
                console.error(`Migration Warning: Could not verify/add column [${col.name}]:`, err.message);
            }
        }
        conn.release();
    })
    .catch(err => {
        console.error('CRITICAL ERROR: Failed to connect to MySQL database on startup!', err.message);
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
const profileRoutes = require('./routes/profile');
const aiRoutes = require('./routes/ai');

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/ai', aiRoutes);

// Basic Route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Student Productivity API' });
});

// Centralized error handling middleware (redacts database internals)
app.use((err, req, res, next) => {
    console.error('INTERNAL_SERVER_ERROR:', err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected internal server error occurred.'
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

