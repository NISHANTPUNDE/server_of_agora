const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const AdminService = require('../services/adminService');
const router = express.Router();
const axios = require('axios');
const db = require('../config/db');

// In-memory storage for active meetings
let activeMeetings = [];
let kickedUsers = [];
let uidMappings = [];


// Generate a proper Agora token
function generateAgoraToken(channelName, uid, APP_ID, APP_CERTIFICATE) {
    // Set token expiration time (in seconds)
    const expirationTimeInSeconds = 7200; // 2 hour

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

function getUserInfoFromMapping(generatedUid) {
    const mapping = uidMappings.find(m => m.generatedUid === generatedUid);
    return mapping ? mapping : null;
}

router.get('/meetings/user-info/:uid', (req, res) => {
    const { uid } = req.params;

    // Find user info in UID mappings without requiring channel name
    const userInfo = uidMappings.find(m => m.generatedUid === parseInt(uid));

    if (!userInfo) {
        return res.status(404).json({
            error: 'User information not found',
            message: `No mapping found for UID: ${uid}`
        });
    }

    return res.status(200).json({
        userName: userInfo.name,
        originalUid: userInfo.originalUid,
        joinTime: userInfo.joinTime,
        // channelName: userInfo.channelName
    });
});
router.get('/meetings/check-participant-status/:channelName/:uid', (req, res) => {
    const { channelName, uid } = req.params;


    // Find the meeting by channel name
    const meeting = activeMeetings.find(m => m.channelName === channelName && m.isActive);

    if (!meeting) {
        // Meeting not found or no longer active
        return res.status(404).json({
            error: 'Meeting not found or no longer active',
            kicked: true
        });
    }

    // Check if this is the admin
    if (meeting.adminUid === parseInt(uid)) {
        // Admin is always in the meeting
        return res.status(200).json({
            kicked: false,
            isAdmin: true
        });
    }

    // Check if the participant is in the teamMembers array
    // const participant = meeting.teamMembers.find(m => m.uid === parseInt(uid));


    if (!participant) {
        // Participant not found in the meeting, they've been kicked
        return res.status(404).json({
            error: 'Participant not found in meeting',
            kicked: true
        });
    }

    // Participant is still in the meeting
    return res.status(200).json({
        kicked: false,
        name: participant.name
    });
})

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
        // console.log(result[0].name)
        // console.log("activeMeetings", activeMeetings)

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

    // console.log("Executing SQL Query...");

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
        console.log("Meeting ID:", meetingId);
        console.log("Meeting:", activeMeetings);
        if (!meeting) {
            console.log("Meeting not found or no longer active.");
            return res.status(404).json({ error: 'Meeting not found or no longer active' });
        }

        console.log("Meeting found:", meeting);

        const timestamp = Date.now() % 100000; // Last 5 digits of timestamp
        const memberUid = 2000 + parseInt(teamid) + timestamp;
        console.log("Generated Member UID:", memberUid);
        uidMappings.push({
            generatedUid: memberUid,
            originalUid: parseInt(teamid),
            name: userName,
            channelName: meeting.channelName,
            joinTime: new Date()
        });
        console.log("UID Mappings:", uidMappings);


        // SQL query to get team and admin details


        // Generate a token for the team member
        const token = generateAgoraToken(meeting.channelName, memberUid, result[0].app_id, result[0].token_id);

        // Add team member to the meeting
        meeting.teamMembers.push({
            uid: memberUid,
            name: userName,
            joinTime: new Date()
        });

        // console.log("Team member added to meeting:", userName);

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

router.post('/meetings/kick-participant', async (req, res) => {
    const { channelName, participantUid, adminUid, app_certificateis } = req.body;
    console.log(`Admin ${adminUid} requested to kick participant ${participantUid} from channel ${channelName}`);
    console.log(app_certificateis, "app_certificateis");

    const meeting = activeMeetings.find(m => m.channelName === channelName && m.isActive);
    if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found or no longer active' });
    }

    if (meeting.adminUid !== parseInt(adminUid)) {
        return res.status(403).json({ error: 'Only the meeting admin can kick participants' });
    }

    const participantIndex = meeting.teamMembers.findIndex(member => member.uid === parseInt(participantUid));
    if (participantIndex === -1) {
        return res.status(404).json({ error: 'Participant not found in the meeting' });
    }

    const removedParticipant = meeting.teamMembers.splice(participantIndex, 1)[0];

    // Add to kicked users with a short expiration (e.g., 5 minutes)
    // This prevents immediate rejoining but isn't permanent
    kickedUsers.push({
        channelName,
        uid: parseInt(participantUid),
        kickedAt: Date.now(),
        expiresAt: Date.now() + (1 * 60 * 1000), // 1 minutes expiration
        name: removedParticipant.name
    });

    // --- Force disconnect using Agora RESTful API ---
    try {
        // The values need to be strings, not bare identifiers
        const sql = `SELECT * FROM admin WHERE admin.token_id = ?`;

        console.log("Executing SQL Query...");

        // Execute the query and use a Promise to handle the async flow
        const dbResult = await new Promise((resolve, reject) => {
            db.query(sql, [app_certificateis], (err, result) => {
                if (err) {
                    console.error("Database Error:", err);
                    reject(err);
                    return;
                }

                console.log("SQL Query Executed. Result length:", result.length);

                if (result.length === 0) {
                    console.log("admin not found");
                    reject(new Error('Admin not found'));
                    return;
                }

                resolve(result);
            });
        }).catch(err => {
            if (err.message === 'Admin not found') {
                return res.status(404).json({ error: 'Admin not found' });
            }
            return res.status(500).json({ error: 'Database error' });
        });

        // If we got here and dbResult is undefined, it means an error was handled
        if (!dbResult) return;

        console.log("Result:", dbResult[0].customerId, dbResult[0].customerSecret);
        const customerId = dbResult[0].customerId;
        const customerSecret = dbResult[0].customerSecret;

        // Create the Basic Auth credentials
        const authString = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');

        // Call Agora's kicking-rule endpoint with Basic Auth
        await axios.post(
            'https://api.agora.io/dev/v1/kicking-rule',
            {
                appid: meeting.APP_ID,
                cname: channelName,
                uid: parseInt(participantUid),
                time: 60 // Ban duration in seconds; adjust as needed
            },
            {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`Force-disconnected user ${participantUid} from Agora channel ${channelName}`);
    } catch (error) {
        console.error("Error force-disconnecting user from Agora:", error.response?.data || error.message);
        // Still return success since we've removed them from our local tracking
    }
    // --- End force disconnect ---

    res.status(200).json({
        success: true,
        message: `${removedParticipant.name} has been removed from the meeting`,
        removedParticipant: {
            uid: removedParticipant.uid,
            name: removedParticipant.name
        }
    });
});



module.exports = router;