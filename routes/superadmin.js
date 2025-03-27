const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db'); // Ensure this path is correct
const router = express.Router();

const JWT_SECRET = 'secret'; // Change this to a secure key

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: '❌ Email and password are required' });
    }

    // ✅ Use callback function instead of async/await
    db.query('SELECT * FROM super_admin WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(401).json({ message: '❌ No Super Admin found with this email' });
        }

        const storedHash = results[0].password_hash;

        bcrypt.compare(password, storedHash, (err, isMatch) => {
            if (err) {
                console.error('❌ Bcrypt error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }

            if (!isMatch) {
                return res.status(401).json({ message: '❌ Incorrect password' });
            }

            // 🔥 Generate JWT Token
            const token = jwt.sign({ id: results[0].id, email: results[0].email }, JWT_SECRET, { expiresIn: '2h' });

            res.json({ message: '✅ Login successful!', token });
        });
    });
});


router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: '❌ Email and password are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.query('INSERT INTO super_admin (email, password_hash) VALUES (?, ?)', [email, hashedPassword]);

        res.json({ message: '✅ Super Admin registered successfully!' });
    } catch (error) {
        console.error('❌ Error during registration:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// ✅ Correctly exporting the router
module.exports = router;
