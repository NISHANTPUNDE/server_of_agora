const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db'); // Ensure this path is correct
const router = express.Router();

const JWT_SECRET = 'secret'; // Change this to a secure key

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: '❌ username and password are required' });
    }

    // ✅ Use callback function instead of async/await
    db.query('SELECT * FROM super_admin WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(401).json({ message: 'Invalid Username Password' });
        }

        const storedHash = results[0].password_hash;

        // bcrypt.compare(password, storedHash, (err, isMatch) => {
        //     if (err) {
        //         console.error('❌ Bcrypt error:', err);
        //         return res.status(500).json({ message: 'Internal server error' });
        //     }

        //     if (!isMatch) {
        //         return res.status(401).json({ message: '❌ Incorrect password' });
        //     }

        if (password !== storedHash) {
            return res.status(401).json({ message: '❌ Incorrect password' });
        }

        // 🔥 Generate JWT Token
        const token = jwt.sign({ id: results[0].id, username: results[0].username }, JWT_SECRET, { expiresIn: '72h' });

        res.json({ message: '✅ Login successful!', token });
    
    });
});


router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: '❌ username and password are required' });
        }

        // const hashedPassword = await bcrypt.hash(password, 10);

        db.query('INSERT INTO super_admin (username, password_hash) VALUES (?, ?)', [username, password]);

        res.json({ message: '✅ Super Admin registered successfully!' });
    } catch (error) {
        console.error('❌ Error during registration:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// ✅ Correctly exporting the router
module.exports = router;
