const express = require('express');
const cors = require('cors');
const superadmin = require('./routes/superadmin');
const admin = require('./routes/admin');
const team = require('./routes/team');
const call = require('./routes/call');
const { createServer } = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

require('dotenv').config();
const db = require('./config/db'); // Assuming you have a db.js file for database connection
const recordings = require('./routes/recordings');


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Access-Control-Allow-Origin', 'Content-Type'],
        credentials: true,
    }
});

// Socket connections by user ID
const userSockets = {};


// Set up Socket.IO
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User registers their UID with the socket
    socket.on('register', (data) => {
        const { uid, channelName, isAdmin } = data;
        console.log(`User ${uid} (${isAdmin ? 'Admin' : 'Member'}) registered for channel ${channelName}`);
        userSockets[uid] = socket.id;

        // Join a room named after the channel
        socket.join(channelName);

        // If a team member is joining, notify everyone in the channel
        if (!isAdmin) {
            io.to(channelName).emit('member-joined', {
                uid: uid,
                timestamp: Date.now()
            });
        }
    });

    // Handle admin leaving (ending the meeting)
    socket.on('admin-left', (data) => {
        const { channelName } = data;
        io.to(channelName).emit('meeting-ended', {
            message: 'The admin has ended the meeting',
            timestamp: Date.now()
        });
    });

    socket.on('disconnect', () => {
        // Remove socket mapping when user disconnects
        for (const uid in userSockets) {
            if (userSockets[uid] === socket.id) {
                delete userSockets[uid];
                break;
            }
        }
    });
});



app.use(cors({
    origin: '*', // Allow from all origins (or specify your frontend domain)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    exposedHeaders: ['Content-Type'], // Expose Content-Type header
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


app.use('/v1/superadmin', superadmin);
app.use('/v1/admin', admin);
app.use('/v1/call', call);
app.use('/v1/team', team);

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const teamId = req.query.teamid || 'default';
        const sql = `SELECT admin.id 
                 FROM team 
                 JOIN admin ON team.admin_id = admin.id 
                 WHERE team.id = ?`;

        db.query(sql, [teamId], (err, result) => {
            if (err) {
                console.error("Database Error:", err);
                cb(new Error('Database error'));
                return;
            }

            if (result.length === 0) {
                cb(new Error('Team not found'));
                return;
            }

            const adminId = result[0].id;
            console.log("Admin ID:", adminId); // Log the admin ID for debugging
            console.log("Team ID:", teamId); // Log the team ID for debugging
            const dir = `./recordings/${adminId}/${teamId}`; // Nested folder structure

            // Create directory if it doesn't exist
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        });
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Create recordings route
app.use('/v1/add/recordings', upload.single('recording'), recordings);

app.use('/v1/download/app', (req, res) => {
    const filePath = path.join(__dirname, 'app', 'skyvoice.apk');
    res.download(filePath, (err) => {
        if (err) {
            console.error("File Download Error:", err);
            res.status(500).send('Error downloading file');
        }
    });
});


const PORT = process.env.PORT || 4020;
httpServer.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

module.exports = { app, io };