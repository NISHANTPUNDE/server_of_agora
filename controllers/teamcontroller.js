const teamService = require('../services/teamService');
const bcrypt = require('bcryptjs');

const TeamController = {
    createTeam: async (req, res) => {
        try {
            console.log(req.body);
            const { name, username, password, email, admin_id, mobilenumber, tokenid, Channelid, createdby } = req.body;

            if (!name || typeof name !== "string") {
                return res.status(400).json({ message: "❌ Name is required and must be a string." });
            }

            if (!username || typeof username !== "string") {
                return res.status(400).json({ message: "❌ username is required and must be a string." });
            }

            // if (!email || typeof email !== "string") {
            //     return res.status(400).json({ message: "❌ Email is required and must be a string." });
            // }

            if (!mobilenumber || typeof mobilenumber !== "string") {
                return res.status(400).json({ message: "❌ Mobile number is required and must be a string." });
            }

            if (!password || typeof password !== "string") {
                return res.status(400).json({ message: "❌ Password is required and must be a string." });
            }

            if (!admin_id || typeof admin_id !== "number") {
                return res.status(400).json({ message: "❌ Admin ID is required and must be a number." });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password.toString(), 10);

            const teamData = { name, password: hashedPassword, username, email, admin_id, mobilenumber, tokenid, Channelid, createdby };

            // Call service function to create team
            const result = await teamService.createTeam(teamData);

            res.json({ message: "✅ Team created successfully!", teamId: result.insertId });
        } catch (error) {
            console.error("❌ Error creating team:", error);
            res.status(error.status || 500).json({ message: error.message });
        }
    },
    listTeams: async (req, res) => {
        try {
            const { pagesize, offset, search } = req.query;
            const teams = await teamService.listTeams(pagesize, offset, search);
            res.json(teams);
        } catch (error) {
            console.error("❌ Error listing teams:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
    deleteTeam: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await teamService.deleteTeam(id);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "❌ Team not found" });
            }
            res.json({ message: "✅ Team deleted successfully" });
        } catch (error) {
            console.error("❌ Error deleting team:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
    loginTeam: async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ message: '❌ Username and password are required' });
            }

            const team = await teamService.loginTeam(username);
            if (!team) {
                return res.status(401).json({ message: '❌ No Team found with this username' });
            }

            const storedHash = team.password;

            bcrypt.compare(password, storedHash, (err, isMatch) => {
                if (err) {
                    console.error('❌ Bcrypt error:', err);
                    return res.status(500).json({ message: 'Internal server error' });
                }

                if (!isMatch) {
                    return res.status(401).json({ message: '❌ Incorrect password' });
                }

                res.json({ message: '✅ Login successful!', teamId: team.id });
            });
        } catch (error) {
            console.error('❌ Error during login:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },
    updateTeam: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, username,  email, admin_id, mobilenumber , tokenid, Channelid} = req.body;

            console.log("req update",req.body)
            // Hash the password
            // const hashedPassword = await bcrypt.hash(password.toString(), 10);

            const teamData = { name, mobilenumber, username, tokenid, Channelid, email, admin_id };

            const result = await teamService.updateTeam(id, teamData);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "❌ Team not found" });
            }

            res.json({ message: "✅ Team updated successfully!" });
        } catch (error) {
            console.error("❌ Error updating team:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
    getTeam: async (req, res) => {
        try {
            const { id } = req.params;
            const team = await teamService.getTeam(id);
            if (!team) {
                return res.status(404).json({ message: "❌ Team not found" });
            }
            res.json(team);
        } catch (error) {
            console.error("❌ Error getting team:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },

    getallTeam: async (req, res) => {
        try {
            const { createdby } = req.params;
            const team = await teamService.getTeambyadmin(createdby);
            if (!team) {
                return res.status(404).json({ message: "❌ Team not found" });
            }
            res.json(team);
        } catch (error) {
            console.error("❌ Error getting team:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
};

module.exports = TeamController;



