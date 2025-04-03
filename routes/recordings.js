const express = require('express');
const router = express.Router();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
router.post('/', async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileInfo = {
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size,
            teamId: req.params.teamid || 'default'
        };

        res.status(200).json({
            message: 'Recording uploaded successfully',
            file: fileInfo
        });
    } catch (error) {
        console.error('Error uploading recording:', error);
        res.status(500).json({ error: 'Error uploading recording' });
    }
});

// Dynamic route to serve recording files
router.get('/recordings/:adminId/:teamId/:filename', (req, res) => {
    const { adminId, teamId, filename } = req.params;
    const filePath = path.join(process.cwd(), 'recordings', adminId, teamId, filename);

    console.log('Serving file from path:', filePath);

    // Check if file exists
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

router.get('/:teamid', (req, res) => {
    const teamId = parseInt(req.params.teamid);
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required' });
    }

    db.query('SELECT admin_id FROM team WHERE id = ?', [teamId], (err, results) => {
        if (err) {
            console.error('Database Error:', err.message);
            return res.status(500).json({ error: 'Database query error' });
        }

        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const adminId = results[0].admin_id;
        console.log("Admin ID:", adminId);

        // Construct the directory path using process.cwd()
        const dir = path.join(process.cwd(), 'recordings', String(adminId), String(teamId));
        console.log('Directory path:', dir);

        try {
            if (!fs.existsSync(dir)) {
                console.log('Directory does not exist:', dir);
                return res.status(404).json({ error: 'No recordings found for this admin' });
            }

            const files = fs.readdirSync(dir);
            if (files.length === 0) {
                return res.status(404).json({ error: 'No recordings found for this admin' });
            }

            console.log('Files found:', files);

            // Construct URLs with properly encoded file names
            const recordings = files.map(file => ({
                filename: file,
                url: `${req.protocol}://${req.get('host')}/v1/add/recordings/recordings/${adminId}/${teamId}/${encodeURIComponent(file)}`
            }));

            res.status(200).json({ recordings });
        } catch (error) {
            console.error('Error retrieving recordings:', error.message);
            res.status(500).json({ error: 'Error retrieving recordings', details: error.message });
        }
    });
});


module.exports = router;
