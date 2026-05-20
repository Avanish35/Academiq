const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const auth = require('../middleware/auth');

router.post('/subtasks', auth, async (req, res) => {
    try {
        const { title } = req.body;
        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Task title is required' });
        }

        // High quality fallback tasks in case API is unavailable or Key is not configured
        const fallbackSubtasks = [
            'Break into smaller actionable steps',
            'Gather reference notes and textbooks',
            'Conduct focused work session',
            'Review answers and correct mistakes'
        ];

        const lowercaseTitle = title.toLowerCase();
        let categorizedFallback = [...fallbackSubtasks];
        if (lowercaseTitle.includes('study') || lowercaseTitle.includes('read')) {
            categorizedFallback = ['Skim the chapter', 'Highlight key terms', 'Create flashcards', 'Take a practice quiz'];
        } else if (lowercaseTitle.includes('project') || lowercaseTitle.includes('build')) {
            categorizedFallback = ['Define requirements', 'Draft initial design', 'Core implementation', 'Testing & Debugging'];
        } else if (lowercaseTitle.includes('exam') || lowercaseTitle.includes('test')) {
            categorizedFallback = ['Organize study notes', 'Solve past papers', 'Memorize formulas', 'Time-limited mock test'];
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.log('AI Route: GEMINI_API_KEY not found in environment variables. Using server rule-based fallback.');
            return res.json({ subtasks: categorizedFallback });
        }

        // Initialize Google Gemini API
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `You are a student productivity assistant. Break down the task title: "${title}" into a list of 3-5 highly actionable, short study subtasks for a student.
Return the output ONLY as a raw JSON array of strings. Do not include markdown formatting or backticks. Example output: ["Read chapter 1", "Summarize notes", "Review questions"].`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        let subtasks = [];
        try {
            // Strip any accidental markdown formatting (e.g. ```json ... ```)
            const cleanedText = responseText
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/, '')
                .replace(/```$/, '')
                .trim();
                
            subtasks = JSON.parse(cleanedText);
            if (!Array.isArray(subtasks)) {
                subtasks = categorizedFallback;
            }
        } catch (parseErr) {
            console.warn('AI Route: Failed to parse Gemini JSON response. Fallback activated. Text:', responseText);
            subtasks = categorizedFallback;
        }

        res.json({ subtasks });
    } catch (err) {
        console.error('AI Route Error:', err.message);
        res.status(500).json({ error: 'Failed to generate AI subtasks. Internal server error.' });
    }
});

module.exports = router;
