const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const AdminService = require('../services/adminService');
const router = express.Router();
const db = require('../config/db');


// Your Agora App credentials
// const APP_ID = "e9d4b556259a45f18121742537c185ad";
// const APP_CERTIFICATE = "4c515d8f0bca49199db5b6b21992dfca";

// In-memory storage for active meetings
let activeMeetings = [];

// Generate a proper Agora token
function generateAgoraToken(channelName, uid, APP_ID, APP_CERTIFICATE) {
    // Set token expiration time (in seconds)
    const expirationTimeInSeconds = 3600; // 1 hour

    // Get current timestamp (in seconds)
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Calculate privilege expire time
    const privilegeExpireTime = currentTimestamp + expirationTimeInSeconds;

    console.log("APP_ID", APP_ID)
    console.log("APP_CERTIFICATE", APP_CERTIFICATE)
    console.log("channelName", channelName)
    console.log("uid", uid)
    console.log("privilegeExpireTime", privilegeExpireTime)

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

router.get('/meetings/user-info/:channelName/:uid', (req, res) => {
    const { channelName, uid } = req.params;

    // Find the meeting by channel name
    const meeting = activeMeetings.find(m => m.channelName === channelName && m.isActive);

    if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found or no longer active' });
    }

    // Check if the user is the admin
    if (meeting.adminUid === parseInt(uid)) {
        return res.status(200).json({
            userName: meeting.adminName,
            isAdmin: true
        });
    }

    // Check if the user is a team member
    const teamMember = meeting.teamMembers.find(m => m.uid === parseInt(uid));
    if (teamMember) {
        return res.status(200).json({
            userName: teamMember.name,
            isAdmin: false
        });
    }

    // User not found
    return res.status(404).json({ error: 'User not found in meeting' });
});

// Create a new meeting (admin endpoint)
router.post('/meetings/create', async (req, res) => {
    const { meetingName, adminName, id } = req.body;

    const result = await AdminService.getAdmin(id);
    console.log("result", result)


    console.log("result", result)

    if (!meetingName || !adminName) {
        return res.status(400).json({ error: 'Meeting name and admin name are required' });
    }

    // Deactivate all currently active meetings
    activeMeetings = activeMeetings.map(meeting => ({
        ...meeting,
        isActive: false
    }));

    const channelName = result.channel_name;
    const adminUid = 1000; // Use a fixed UID for admin (e.g., 1000)
    const APP_ID = result.app_id;
    console.log("APP_ID", result.app_id)
    const APP_CERTIFICATE = result.token_id;
    const token = generateAgoraToken(channelName, adminUid, APP_ID, APP_CERTIFICATE);


    const newMeeting = {
        id: Date.now(),
        name: meetingName,
        APP_ID,
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

    console.log(`Admin requested to ${mute ? 'mute' : 'unmute'} user ${memberUid} in channel ${channelName}`);

    res.status(200).json({ success: true });
});

// Get all active meetings (team member endpoint)
router.get('/meetings/active', (req, res) => {
    const { teamid } = req.query;
    console.log("Received Request:", req.query);
    // Query to get admin information for the team
    const sql = `SELECT admin.name 
                 FROM team 
                 JOIN admin ON team.admin_id = admin.id 
                 WHERE team.id = ?`;

    db.query(sql, [teamid], (err, result) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }
        console.log(result[0].name)
        console.log("activeMeetings", activeMeetings)

        // Filter active meetings where admin name matches
        const filteredMeetings = activeMeetings.filter(meeting =>
            meeting.adminName === result[0].name && meeting.isActive === true
        );

        res.status(200).json(filteredMeetings);
    });
});

// Join a meeting (team member endpoint)



router.post('/meetings/join', (req, res) => {
    const { meetingId, userName, teamid } = req.body;

    console.log("Received Request:", req.body);
    const sql = `SELECT  admin.*
    FROM team   
    JOIN admin ON team.admin_id = admin.id
    WHERE team.id = ?`;

    console.log("Executing SQL Query...");

    // Execute the query
    db.query(sql, [teamid], (err, result) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: 'Database error' });
        }

        console.log("SQL Query Executed. Result length:", result.length);

        if (result.length === 0) {
            console.log("Team not found");
            return res.status(404).json({ error: 'Team not found' });
        }

        console.log("Result:", result[0].app_id, result[0].token_id);

        // Find the active meeting by ID
        const meeting = activeMeetings.find(m => m.id === parseInt(meetingId) && m.isActive);
        if (!meeting) {
            console.log("Meeting not found or no longer active.");
            return res.status(404).json({ error: 'Meeting not found or no longer active' });
        }

        console.log("Meeting found:", meeting);

        // Generate a unique UID for this member
        const memberUid = 2000 + teamid;
        console.log("Generated Member UID:", memberUid);

        // SQL query to get team and admin details


        // Generate a token for the team member
        const token = generateAgoraToken(meeting.channelName, memberUid, result[0].app_id, result[0].token_id);

        // Add team member to the meeting
        meeting.teamMembers.push({
            uid: memberUid,
            name: userName,
            joinTime: new Date()
        });

        console.log("Team member added to meeting:", userName);

        // Send response with meeting details and generated token
        res.status(200).json({
            meeting: {
                ...meeting,
                token: token,
                uid: memberUid,
                permissionInfo: {
                    required: ['camera', 'microphone'],
                    instructions: 'Please allow access to your camera and microphone when prompted by the browser.'
                }
            }
        });
    });
});



// Simple token-only endpoint (for testing)
// router.get('/token', (req, res) => {
//     const channelName = req.query.channel || 'test';
//     const uid = parseInt(req.query.uid) || 0;

//     const token = generateAgoraToken(channelName, uid);

//     res.json({ token });
// });





module.exports = router;