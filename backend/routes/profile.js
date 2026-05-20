const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/avatars'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `avatar-${req.user}-${uniqueSuffix}${ext}`);
    }
});

// File filter (accept only images)
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimeType = allowedTypes.test(file.mimetype);
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimeType && extName) {
        return cb(null, true);
    }
    cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// GET Profile details
router.get('/', auth, async (req, res) => {
    try {
        const db = req.app.get('db');
        const [users] = await db.query(
            'SELECT id, name, email, status, avatar, institution, year, field, student_id AS studentId, goal, quote FROM users WHERE id = ?',
            [req.user]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(users[0]);
    } catch (err) {
        console.error('Fetch Profile Error:', err.message);
        res.status(500).json({ error: 'Failed to retrieve profile data' });
    }
});

// PUT Update Profile details
router.put('/', auth, async (req, res) => {
    try {
        const { name, email, institution, year, field, studentId, goal, quote } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Name is required' });
        }
        if (!email || email.trim() === '') {
            return res.status(400).json({ error: 'Email is required' });
        }

        const db = req.app.get('db');

        // Check if email already in use by another user
        const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email.trim(), req.user]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email is already in use by another account' });
        }

        await db.query(
            `UPDATE users 
             SET name = ?, email = ?, institution = ?, year = ?, field = ?, student_id = ?, goal = ?, quote = ? 
             WHERE id = ?`,
            [
                name.trim(),
                email.trim(),
                institution ? institution.trim() : null,
                year || 'Freshman',
                field ? field.trim() : null,
                studentId ? studentId.trim() : null,
                goal ? goal.trim() : null,
                quote ? quote.trim() : null,
                req.user
            ]
        );

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: req.user,
                name: name.trim(),
                email: email.trim(),
                institution: institution ? institution.trim() : '',
                year: year || 'Freshman',
                field: field ? field.trim() : '',
                studentId: studentId ? studentId.trim() : '',
                goal: goal ? goal.trim() : '',
                quote: quote ? quote.trim() : ''
            }
        });
    } catch (err) {
        console.error('Update Profile Error:', err.message);
        res.status(500).json({ error: 'Failed to update profile details' });
    }
});

// POST Upload profile picture (avatar)
router.post('/avatar', auth, (req, res) => {
    upload.single('avatar')(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Please select an image file to upload.' });
        }

        try {
            const db = req.app.get('db');

            // 1. Fetch old avatar to delete it from disk and save storage space!
            const [users] = await db.query('SELECT avatar FROM users WHERE id = ?', [req.user]);
            if (users.length > 0 && users[0].avatar) {
                const oldAvatarPath = users[0].avatar;
                // If it starts with /uploads, delete the file locally
                if (oldAvatarPath.startsWith('/uploads/')) {
                    const fullPath = path.join(__dirname, '..', oldAvatarPath);
                    fs.unlink(fullPath, (unlinkErr) => {
                        if (unlinkErr) console.warn('Could not delete old avatar file:', unlinkErr.message);
                    });
                }
            }

            // 2. Save new avatar relative path in database
            const relativePath = `/uploads/avatars/${req.file.filename}`;
            await db.query('UPDATE users SET avatar = ? WHERE id = ?', [relativePath, req.user]);

            res.json({
                message: 'Avatar uploaded successfully',
                avatarUrl: relativePath
            });
        } catch (dbErr) {
            console.error('Avatar DB Error:', dbErr.message);
            res.status(500).json({ error: 'Database update failed' });
        }
    });
});

module.exports = router;
