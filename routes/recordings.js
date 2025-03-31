const express = require('express');
const router = express.Router();

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

router.get('/:adminId', (req, res) => {
    const adminId = req.params.adminId;
    const dir = `./recordings/${teamId}/${adminId}`; // Adjust the path as needed

    try {
        if (!fs.existsSync(dir)) {
            return res.status(404).json({ error: 'No recordings found for this admin' });
        }

        const files = fs.readdirSync(dir);
        const recordings = files.map(file => ({
            filename: file,
            path: path.join(dir, file)
        }));

        res.status(200).json({
            recordings: recordings
        });
    } catch (error) {
        console.error('Error retrieving recordings:', error);
        res.status(500).json({ error: 'Error retrieving recordings' });
    }
});

module.exports = router;
