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

router.post('/saveprice', async (req, res) => {
    try {
        const { price } = req.body;

        if (!price) {
            return res.status(400).json({ message: 'price required' });
        }

        const checkQuery = 'SELECT id FROM price WHERE id = 1';
        db.query(checkQuery, (err, result) => {
            if (err) {
                console.error('❌ Error checking price:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }

            if (result.length === 0) {
                // Insert if ID 1 is not present
                const insertQuery = 'INSERT INTO price (id, price) VALUES (1, ?)';
                db.query(insertQuery, [price], (err) => {
                    if (err) {
                        console.error('❌ Error inserting price:', err);
                        return res.status(500).json({ message: 'Internal server error' });
                    }
                    res.json({ message: '✅ Price added successfully!' });
                });
            } else {
                // Update if ID 1 is present
                const updateQuery = 'UPDATE price SET price = ? WHERE id = 1';
                db.query(updateQuery, [price], (err) => {
                    if (err) {
                        console.error('❌ Error updating price:', err);
                        return res.status(500).json({ message: 'Internal server error' });
                    }
                    res.json({ message: '✅ Price updated successfully!' });
                });
            }
        });
    } catch (error) {
        console.error('❌ Error during price add/update:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getprice', (req, res) => {
    try {
        const sql = 'SELECT * FROM price';
        db.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Error during Save price:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            res.json({ Price: result })
        })
    } catch (error) {
        console.log("error", error);
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/savehistory', async (req, res) => {
    try {
        const { name, date, calltime, userid, billableMinutes } = req.body;
        console.log("req.body", req.body)

        // Validate input
        if (!name || !date || calltime === undefined || !userid) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (calltime === 0) {
            return res.status(400).json({ message: 'Call time cannot be zero' });
        }

        if (typeof calltime !== 'string' || !/min=\d+,\s*sec=\d+/.test(calltime)) {
            console.log("typeof calltime",typeof calltime)
            return res.status(400).json({ message: 'Invalid call time format' });
        }


        // Fetch price from database
        const sqlPrice = 'SELECT price FROM price';
        db.query(sqlPrice, (err, priceResult) => {
            if (err) {
                console.error('❌ Error fetching price:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            console.log("priceResult", priceResult)
            if (!priceResult.length || isNaN(priceResult[0].price)) {
                return res.status(400).json({ message: 'Invalid price data' });
            }

            const pricePer1000Min = parseFloat(priceResult[0].price);

            const match = calltime.match(/min=(\d+), sec=(\d+)/);

            let cost = 0; // define cost in outer scope
            if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);

                // Convert to total minutes as decimal
                const totalMinutes = minutes + seconds / 60;
console.log("billableMinutes",billableMinutes)

                // Agora cost calculation
                cost = ((billableMinutes / 1000) * pricePer1000Min).toFixed(4);

                console.log(`Call Duration: ${totalMinutes.toFixed(2)} minutes`);
                console.log(`Agora Audio Call Cost: $${cost}`);
            } else {
                console.log("Invalid calltime format.");
            }

            // Ensure cost is a valid number
            if (isNaN(cost) || cost === 'NaN') {
                return res.status(400).json({ message: 'Error calculating cost' });
            }

            // Insert call history
            const sqlInsert = 'INSERT INTO callhistory (name, date, calltime, cost, userid) VALUES (?, ?, ?, ?, ?)';
            db.query(sqlInsert, [name, date, calltime, cost, userid], (err, result) => {
                if (err) {
                    console.error('❌ Error saving history:', err);
                    return res.status(500).json({ message: 'Internal server error' });
                }
                res.json({ message: 'History saved successfully!', cost });
            });
        });

    } catch (error) {
        console.error('❌ Unexpected Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.get('/gethistory', (req, res) => {
    try {
        const sql = 'SELECT * FROM callhistory';
        db.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Error during Save history:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            res.json({ message: 'Admin call history', Histoty: result })
        })
    } catch (error) {
        console.log("error", error);
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.delete('/deletehistory/:id', (req, res) => {
    console.log("request data",)
    try {
        const { id } = req.params;
        console.log(id)
        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid ID provided' });
        }

        const sql = 'DELETE FROM callhistory WHERE id = ?';

        // Use db.query() directly as it's exported from your module
        db.query(sql, [id], (err, result) => {
            if (err) {
                console.error('❌ Error during deleting history:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'History record not found' });
            }
            res.json({ message: 'History record deleted successfully' });
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/deletehistory', (req, res) => {
    console.log("req", req.body.data);
    const { superadminname, fromDate, toDate, selectedUser } = req.body.data;

    if (superadminname !== 'admin@123') {
        return res.status(403).json({ message: 'Unauthorized access' });
    }

    if (!fromDate || !toDate) {
        return res.status(400).json({ message: 'Both fromDate and toDate are required' });
    }

    let sql = `DELETE FROM callhistory WHERE date BETWEEN ? AND ?`;
    const params = [fromDate, toDate];

    if (selectedUser !== 'all') {
        sql += ` AND name = ?`;
        params.push(selectedUser);
    }

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('❌ Error deleting call history:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        res.json({
            message: 'Call history deleted successfully',
            deletedRows: result.affectedRows
        });
    });
});




// ✅ Correctly exporting the router
module.exports = router;
