const express = require('express');
const cors = require('cors');
const superadmin = require('./routes/superadmin');
const admin = require('./routes/admin');
const team = require('./routes/team');
const call = require('./routes/call');
const { createServer } = require('http');
const { Server } = require('socket.io');


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
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



app.use(cors());

app.use(express.json());


app.use('/v1/superadmin', superadmin);
app.use('/v1/admin', admin);
app.use('/v1/call', call);
app.use('/v1/team', team);

// app.use('/v1/user', user);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server started on http://localhost:3000`);
});

module.exports = { app, io };