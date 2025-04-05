const express = require('express');
const router = express.Router();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

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
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);
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
                return res.status(404).json({ error: 'No recordings found for this user' });
            }

            const allFiles = fs.readdirSync(dir);
            if (allFiles.length === 0) {
                return res.status(404).json({ error: 'No recordings found for this user' });
            }

            // Calculate the timestamp for 24 hours ago
            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

            // Filter files created within the last 24 hours
            const recentFiles = allFiles.filter(file => {
                const filePath = path.join(dir, file);
                try {
                    const stats = fs.statSync(filePath);
                    return stats.ctime > twentyFourHoursAgo;
                } catch (err) {
                    console.error(`Error checking file stats for ${file}:`, err);
                    return false;
                }
            });

            console.log(`Files found: ${allFiles.length}, Recent files (last 24h): ${recentFiles.length}`);

            if (recentFiles.length === 0) {
                return res.status(404).json({ error: 'No recordings found within the last 24 hours' });
            }

            // Construct URLs with properly encoded file names
            const recordings = recentFiles.map(file => ({
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
router.get('/recordings/admin/:adminId', async (req, res) => {
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

        for (const teamId of teamFolders) {
            const teamDir = path.join(dir, teamId);
            const files = fs.readdirSync(teamDir);

            // Fetch team name from DB using promise-based query
            const [rows] = await db.promise().query(
                'SELECT name FROM team WHERE id = ? AND admin_id = ?',
                [teamId, adminId]
            );

            const teamName = rows.length > 0 ? rows[0].name : null;

            files.forEach(file => {
                recordings.push({
                    filename: file,
                    teamId: teamId,
                    teamName: teamName,
                    url: `${req.protocol}://${req.get('host')}/v1/add/recordings/recordings/${adminId}/${teamId}/${encodeURIComponent(file)}`
                });
            });
        }

        if (recordings.length === 0) {
            return res.status(404).json({ error: 'No recordings found for this admin' });
        }

        res.status(200).json({ recordings });
    } catch (error) {
        console.error('Error retrieving recordings:', error.message);
        res.status(500).json({ error: 'Error retrieving recordings', details: error.message });
    }
});


// DELETE route to delete ALL recordings across ALL admins


router.delete('/superadmin/all', async (req, res) => {
    try {
        const superadminname = "admin@123";
        if (req.body.superadminname !== superadminname) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Invalid superadmin name'
            });
        }


        // Path to the recordings directory
        const recordingsDir = path.join(process.cwd(), 'recordings');

        // Check if directory exists
        if (!fs.existsSync(recordingsDir)) {
            return res.status(404).json({
                success: false,
                message: 'No recordings directory found'
            });
        }

        // Get all admin folders
        const adminFolders = fs.readdirSync(recordingsDir);
        if (adminFolders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No admin recordings found'
            });
        }

        let deletedAdmins = 0;
        let deletedTeams = 0;
        let deletedFiles = 0;

        // Process each admin folder
        for (const adminId of adminFolders) {
            const adminDir = path.join(recordingsDir, adminId);

            // Skip if not a directory
            if (!fs.existsSync(adminDir) || !fs.lstatSync(adminDir).isDirectory()) {
                continue;
            }

            // Get all team folders for this admin
            const teamFolders = fs.readdirSync(adminDir);

            // Process each team folder
            for (const teamId of teamFolders) {
                const teamDir = path.join(adminDir, teamId);

                // Skip if not a directory
                if (!fs.existsSync(teamDir) || !fs.lstatSync(teamDir).isDirectory()) {
                    continue;
                }

                // Get all files in this team folder
                const files = fs.readdirSync(teamDir);

                // Delete each file
                for (const file of files) {
                    const filePath = path.join(teamDir, file);
                    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                        deletedFiles++;
                    }
                }

                // Remove empty team directory
                fs.rmdirSync(teamDir);
                deletedTeams++;
            }

            // Remove empty admin directory
            fs.rmdirSync(adminDir);
            deletedAdmins++;
        }

        return res.status(200).json({
            success: true,
            message: 'Successfully deleted all recordings across all admins',
            stats: {
                admins: deletedAdmins,
                teams: deletedTeams,
                files: deletedFiles
            }
        });

    } catch (error) {
        console.error('Error deleting all recordings:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting recordings',
            error: error.message
        });
    }
});

// DELETE route to delete all recordings for a specific team
router.delete('/admin/:adminId/team/:teamId', async (req, res) => {
    try {
        const { adminId, teamId } = req.params;

        // First verify that this admin owns this team
        const verifyAdminQuery = 'SELECT * FROM team WHERE id = ? AND admin_id = ?';

        db.query(verifyAdminQuery, [teamId, adminId], async (err, results) => {
            if (err) {
                console.error('Database Error:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Database query error',
                    error: err.message
                });
            }

            // If no results, this admin doesn't own the team
            if (!results || results.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: `Unauthorized: Admin ID ${adminId} is not authorized to delete recordings for user ID ${teamId}`
                });
            }

            // Admin verified, proceed with deletion
            // Path to the team's recordings directory
            const teamDir = path.join(process.cwd(), 'recordings', String(adminId), String(teamId));

            // Check if directory exists
            if (!fs.existsSync(teamDir)) {
                return res.status(404).json({
                    success: false,
                    message: `No recordings found for user ID: ${teamId} under admin ID: ${adminId}`
                });
            }

            // Check if it's actually a directory
            if (!fs.lstatSync(teamDir).isDirectory()) {
                return res.status(400).json({
                    success: false,
                    message: 'Path is not a directory'
                });
            }

            // Get all files in the team directory
            const files = fs.readdirSync(teamDir);
            let deletedFiles = 0;

            // Delete each file in the team directory
            for (const file of files) {
                const filePath = path.join(teamDir, file);
                if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                    deletedFiles++;
                }
            }

            // Remove the team directory if requested (optional)
            if (deletedFiles > 0) {
                fs.rmdirSync(teamDir);
            }

            return res.status(200).json({
                success: true,
                message: `Successfully deleted all recordings for team ID: ${teamId}`,
                deletedFiles: deletedFiles
            });
        });

    } catch (error) {
        console.error('Error deleting team recordings:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting team recordings',
            error: error.message
        });
    }
});




module.exports = router;
