const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const cors = require('cors');
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

const router = express.Router();

// Enable CORS
app.use(cors());
app.use(express.json());

// Your Agora App credentials
const APP_ID = "e9d4b556259a45f18121742537c185ad";
const APP_CERTIFICATE = "4c515d8f0bca49199db5b6b21992dfca"; // Get this from Agora Console

// In-memory storage for active meetings
let activeMeetings = [];

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

        // Remove meeting from active meetings
        activeMeetings = activeMeetings.filter(m => m.channelName !== channelName);
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

// Generate a proper Agora token
function generateAgoraToken(channelName, uid) {
    // Set token expiration time (in seconds)
    const expirationTimeInSeconds = 3600; // 1 hour

    // Get current timestamp (in seconds)
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Calculate privilege expire time
    const privilegeExpireTime = currentTimestamp + expirationTimeInSeconds;

    // Build the token with RTC role as publisher
    return RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpireTime
    );
}

// Create a new meeting (admin endpoint)
router.post('/meetings/create', (req, res) => {
    const { meetingName, adminName } = req.body;

    if (!meetingName || !adminName) {
        return res.status(400).json({ error: 'Meeting name and admin name are required' });
    }

    const channelName = `meeting-${Date.now()}-${meetingName.replace(/\s+/g, '-').toLowerCase()}`;
    const adminUid = 1000; // Use a fixed UID for admin (e.g., 1000)
    const token = generateAgoraToken(channelName, adminUid);

    const newMeeting = {
        id: Date.now(),
        name: meetingName,
        adminName,
        channelName,
        token,
        adminUid,
        startTime: new Date(),
        isActive: true,
        teamMembers: [] // Array to store team members in this meeting
    };

    activeMeetings.push(newMeeting);

    res.status(201).json(newMeeting);
});

// Update meeting status (admin endpoint)
router.post('/meetings/update', (req, res) => {
    const { isActive, channelName } = req.body;

    const meetingIndex = activeMeetings.findIndex(m => m.channelName === channelName);

    if (meetingIndex === -1) {
        return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update meeting status
    activeMeetings[meetingIndex].isActive = isActive;

    // If meeting is no longer active, remove it from active meetings
    if (!isActive) {
        activeMeetings = activeMeetings.filter(m => m.channelName !== channelName);
    }

    res.status(200).json({ success: true });
});

// Mute or unmute a team member (admin endpoint)
router.post('/meetings/mute-member', (req, res) => {
    const { channelName, memberUid, mute } = req.body;

    const meeting = activeMeetings.find(m => m.channelName === channelName);

    if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
    }

    // Emit mute command to the specific user
    io.to(channelName).emit('mute-command', {
        uid: memberUid,
        mute
    });

    console.log(`Admin requested to ${mute ? 'mute' : 'unmute'} user ${memberUid} in channel ${channelName}`);

    res.status(200).json({ success: true });
});

// Get all active meetings (team member endpoint)
router.get('/meetings/active', (req, res) => {
    res.status(200).json(activeMeetings);
});

// Join a meeting (team member endpoint)
router.post('/meetings/join', (req, res) => {
    const { meetingId, userName } = req.body;

    const meeting = activeMeetings.find(m => m.id === parseInt(meetingId));

    if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found or no longer active' });
    }

    // Generate a unique UID for this member (greater than 1000 to avoid conflict with admin)
    const memberUid = 2000 + Math.floor(Math.random() * 1000);

    // Generate a token for this team member
    const token = generateAgoraToken(meeting.channelName, memberUid);

    // Add team member to the meeting
    meeting.teamMembers.push({
        uid: memberUid,
        name: userName,
        joinTime: new Date()
    });

    res.status(200).json({
        meeting: {
            ...meeting,
            token: token,  // Send the team member-specific token
            uid: memberUid  // Send the member's UID
        }
    });
});

// Simple token-only endpoint (for testing)
router.get('/token', (req, res) => {
    const channelName = req.query.channel || 'test';
    const uid = parseInt(req.query.uid) || 0;

    const token = generateAgoraToken(channelName, uid);

    res.json({ token });
});

app.use(router);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;