const express = require('express');
const router = express.Router();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const stream = require('stream');

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
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(process.cwd(), 'recordings', adminId, teamId, decodedFilename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    let mimeType = mime.lookup(filePath);
    mimeType = mimeType || (filePath.endsWith('.m4a') ? 'audio/mp4' : 'application/octet-stream');

    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        let start = parseInt(parts[0], 10) || 0;
        let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        start = Math.max(0, start);
        end = Math.min(end, fileSize - 1);

        if (start >= fileSize) {
            return res.status(416).set({ 'Content-Range': `bytes */${fileSize}` }).end();
        }

        const chunkSize = end - start + 1;
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=3600'
        });

        const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 });
        stream.on('error', (err) => {
            console.error('Stream error:', err);
            res.end();
        });
        stream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600'
        });
        const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
        stream.on('error', (err) => {
            console.error('Stream error:', err);
            res.end();
        });
        stream.pipe(res);
    }

    req.on('close', () => {
        stream.destroy();
    });
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

        const dir = path.join(process.cwd(), 'recordings', String(adminId), String(teamId));
        console.log('Directory path:', dir);

        try {
            if (!fs.existsSync(dir)) {
                console.log('Directory does not exist:', dir);
                return res.status(404).json({ error: 'No recordings found for this user' });
            }

            const allFiles = fs.readdirSync(dir);
            if (allFiles.length === 0) {
                return res.status(404).json({ error: 'No recordings found for this user' });
            }

            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

            // Get files with stats and filter by ctime > 24 hours ago
            const recentFilesWithStats = allFiles.map(file => {
                const filePath = path.join(dir, file);
                try {
                    const stats = fs.statSync(filePath);
                    return { file, ctime: stats.ctime };
                } catch (err) {
                    console.error(`Error checking file stats for ${file}:`, err);
                    return null;
                }
            }).filter(item => item && item.ctime > twentyFourHoursAgo);

            // Sort descending by ctime
            recentFilesWithStats.sort((a, b) => b.ctime - a.ctime);

            const recentFiles = recentFilesWithStats.map(item => item.file);

            console.log(`Files found: ${allFiles.length}, Recent files (last 24h): ${recentFiles.length}`);

            if (recentFiles.length === 0) {
                return res.status(404).json({ error: 'No recordings found within the last 24 hours' });
            }

            const recordings = recentFiles.map(file => ({
                filename: file,
                url: `https://${req.get('host')}/v1/add/recordings/recordings/${adminId}/${teamId}/${encodeURIComponent(file)}`
            }));

            res.status(200).json({ recordings });
        } catch (error) {
            console.error('Error retrieving recordings:', error.message);
            res.status(500).json({ error: 'Error retrieving recordings', details: error.message });
        }
    });
});



// router.get('/recordings/admin/:adminId', (req, res) => {
//     const adminId = req.params.adminId;

//     const dir = path.join(process.cwd(), 'recordings', String(adminId));
//     console.log('Directory path:', dir);

//     try {
//         if (!fs.existsSync(dir)) {

//             console.log('Directory does not exist:', dir);
//             return res.status(404).json({ error: 'No recordings found for this admin' });
//         }

//         const teamFolders = fs.readdirSync(dir);
//         const recordings = [];

//         teamFolders.forEach(teamId => {
//             const teamDir = path.join(dir, teamId);
//             const files = fs.readdirSync(teamDir);

//             files.forEach(file => {
// recordings.push({
//     filename: file,
//     teamId: teamId,
//     url: `${req.protocol}://${req.get('host')}/v1/add/recordings/${adminId}/${teamId}/${encodeURIComponent(file)}`
// });
//             });
//         });

//         if (recordings.length === 0) {
//             return res.status(404).json({ error: 'No recordings found for this admin' });
//         }

//         res.status(200).json({ recordings });
//     } catch (error) {
//         console.error('Error retrieving recordings:', error.message);
//         res.status(500).json({ error: 'Error retrieving recordings', details: error.message });
//     }
// });

// DELETE route for superadmin to delete all recordings for a specific admin
// router.delete('/superadmin/admin/:adminId', async (req, res) => {
//     try {
//         const adminId = req.params.adminId;

//         // Path to the admin's recordings directory
//         const adminDir = path.join(process.cwd(), 'recordings', String(adminId));

//         // Check if directory exists
//         if (!fs.existsSync(adminDir)) {
//             return res.status(404).json({
//                 success: false,
//                 message: `No recordings found for admin ID: ${adminId}`
//             });
//         }

//         // Get all team folders for this admin
//         const teamFolders = fs.readdirSync(adminDir);
//         let deletedFiles = 0;

//         // Delete all files in each team folder
//         for (const teamId of teamFolders) {
//             const teamDir = path.join(adminDir, teamId);
//             if (fs.existsSync(teamDir) && fs.lstatSync(teamDir).isDirectory()) {
//                 const files = fs.readdirSync(teamDir);

//                 // Delete each file in the team directory
//                 for (const file of files) {
//                     const filePath = path.join(teamDir, file);
//                     fs.unlinkSync(filePath);
//                     deletedFiles++;
//                 }

//                 // Optionally remove the empty team directory
//                 fs.rmdirSync(teamDir);
//             }
//         }

//         // Optionally remove the admin directory if empty
//         if (fs.readdirSync(adminDir).length === 0) {
//             fs.rmdirSync(adminDir);
//         }

//         return res.status(200).json({
//             success: true,
//             message: `Successfully deleted all recordings for admin ID: ${adminId}`,
//             deletedFiles: deletedFiles
//         });

//     } catch (error) {
//         console.error('Error deleting recordings:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Error deleting recordings',
//             error: error.message
//         });
//     }
// });
router.get('/recordings/admin/:adminId', (req, res) => {
    const adminId = req.params.adminId;
    const dir = path.join(process.cwd(), 'recordings', String(adminId));
    console.log('Directory path:', dir);

    try {
        if (!fs.existsSync(dir)) {
            console.log('Directory does not exist:', dir);
            return res.status(404).json({ error: 'No recordings found for this admin' });
        }

        const teamFolders = fs.readdirSync(dir);
        const recordings = [];
        let processedFolders = 0;

        // If no team folders exist
        if (teamFolders.length === 0) {
            return res.status(404).json({ error: 'No recordings found for this admin' });
        }

        teamFolders.forEach(teamId => {
            const teamDir = path.join(dir, teamId);
            const files = fs.readdirSync(teamDir);

            // Use callback style query instead of promise
            db.query(
                'SELECT name FROM team WHERE id = ? AND admin_id = ?',
                [teamId, adminId],
                (err, rows) => {
                    if (err) {
                        console.error(`Error querying team name for team ID ${teamId}:`, err);
                    }

                    const teamName = rows && rows.length > 0 ? rows[0].name : null;

                    files.forEach(file => {
                        recordings.push({
                            filename: file,
                            teamId: teamId,
                            teamName: teamName,
                            url: `https://${req.get('host')}/v1/add/recordings/recordings/${adminId}/${teamId}/${encodeURIComponent(file)}`
                        });
                    });

                    processedFolders++;

                    // Check if all folders have been processed
                    if (processedFolders === teamFolders.length) {
                        if (recordings.length === 0) {
                            return res.status(404).json({ error: 'No recordings found for this admin' });
                        }
                        res.status(200).json({ recordings });
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error retrieving recordings:', error.message);
        res.status(500).json({ error: 'Error retrieving recordings', details: error.message });
    }
});

// DELETE route to delete recordings within a specific date range
router.delete('/superadmin/delete', (req, res) => {
    try {
        const superadminname = "admin@123";
        if (req.body.superadminname !== superadminname) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Invalid superadmin name'
            });
        }

        const { fromDate, toDate, selectedUser } = req.body;

        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;

        if (!from || isNaN(from.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid fromDate parameter' });
        }

        if (!to || isNaN(to.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid toDate parameter' });
        }

        to.setHours(23, 59, 59, 999); // end of toDate

        // Path to the recordings directory
        const recordingsDir = path.join(process.cwd(), 'recordings');
        if (!fs.existsSync(recordingsDir)) {
            return res.status(404).json({ success: false, message: 'No recordings directory found' });
        }
        console.log(selectedUser, "selectedUser")
        // Use callback instead of promise
        if (selectedUser !== "all") {
            // Get admin ID from DB
            db.query('SELECT id FROM admin WHERE name = ?', [selectedUser], (err, rows) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Database error', error: err.message });
                }

                if (!rows.length) {
                    return res.status(404).json({ success: false, message: 'Admin not found' });
                }

                const allowedAdminIds = [String(rows[0].id)];
                processDeleteRecordings(allowedAdminIds);
            });
        } else {
            // Get all admin folders (folder names are admin IDs)
            const allowedAdminIds = fs.readdirSync(recordingsDir).filter(name => {
                const fullPath = path.join(recordingsDir, name);
                return fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory();
            });

            processDeleteRecordings(allowedAdminIds);
        }

        function processDeleteRecordings(allowedAdminIds) {
            let deletedFiles = 0, skippedFiles = 0;
            let emptyTeamDirs = 0, emptyAdminDirs = 0;

            for (const adminId of allowedAdminIds) {
                const adminDir = path.join(recordingsDir, adminId);
                if (!fs.existsSync(adminDir) || !fs.lstatSync(adminDir).isDirectory()) continue;

                const teamFolders = fs.readdirSync(adminDir);
                for (const teamId of teamFolders) {
                    const teamDir = path.join(adminDir, teamId);
                    if (!fs.existsSync(teamDir) || !fs.lstatSync(teamDir).isDirectory()) continue;

                    const files = fs.readdirSync(teamDir);
                    for (const file of files) {
                        const filePath = path.join(teamDir, file);
                        try {
                            const stats = fs.statSync(filePath);
                            const fileDate = new Date(stats.ctime);

                            if (fileDate >= from && fileDate <= to) {
                                fs.unlinkSync(filePath);
                                deletedFiles++;
                            } else {
                                skippedFiles++;
                            }
                        } catch (err) {
                            console.error('File stat error:', filePath, err.message);
                            skippedFiles++;
                        }
                    }

                    // Remove empty team directory
                    if (fs.readdirSync(teamDir).length === 0) {
                        fs.rmdirSync(teamDir);
                        emptyTeamDirs++;
                    }
                }

                // Remove empty admin directory
                if (fs.readdirSync(adminDir).length === 0) {
                    fs.rmdirSync(adminDir);
                    emptyAdminDirs++;
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Successfully deleted recordings',
                dateRange: {
                    from: from.toISOString(),
                    to: to.toISOString()
                },
                stats: {
                    deletedFiles,
                    skippedFiles,
                    emptyTeamDirs,
                    emptyAdminDirs
                }
            });
        }
    } catch (error) {
        console.error('Error during delete:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
});

// delete recoding 
router.delete('/recordings/delete-from-url', async (req, res) => {
    try {
        const { superadminname, files } = req.body;
        const superadminKey = "admin@123";

        if (superadminname !== superadminKey) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Invalid superadmin name'
            });
        }

        if (!Array.isArray(files) || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files provided for deletion'
            });
        }

        const recordingsDir = path.join(process.cwd(), 'recordings');

        let deletedFiles = 0;
        let errors = [];

        for (const { url, teamId, filename } of files) {
            if (!url || !teamId || !filename) {
                errors.push({ url, teamId, filename, error: "Missing required fields" });
                continue;
            }

            // Extract adminId from the URL (assuming fixed pattern)
            const match = url.match(/\/recordings\/(\d+)\//);
            const adminId = match ? match[1] : null;

            if (!adminId) {
                errors.push({ url, teamId, filename, error: "Could not extract adminId from URL" });
                continue;
            }

            const filePath = path.join(recordingsDir, adminId, teamId.toString(), filename);

            try {
                if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                    deletedFiles++;
                } else {
                    errors.push({ adminId, teamId, filename, error: "File does not exist" });
                }
            } catch (err) {
                errors.push({ adminId, teamId, filename, error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Deletion process completed',
            deletedFiles,
            failed: errors.length,
            errors
        });

    } catch (err) {
        console.error('Error in delete-from-url:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while deleting files',
            error: err.message
        });
    }
});





module.exports = router;
