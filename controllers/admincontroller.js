const AdminService = require('../services/adminService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "nishant"

const AdminController = {
    createAdmin: async (req, res) => {
        try {
            console.log(req.body);
            const { username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits } = req.body;

            if (!username || typeof username !== "string") {
                return res.status(400).json({ message: "❌ Username is required and must be a string." });
            }

            // if (!email || typeof email !== "string") {
            //     return res.status(400).json({ message: "❌ Email is required and must be a string." });
            // }

            if (!password || typeof password !== "string") {
                return res.status(400).json({ message: "❌ Password is required and must be a string." });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password.toString(), 10);

            const adminData = { username, password: hashedPassword, email, app_id, app_certificate, channel_name, token_id, adminlimits };

            // Call service function to create admin
            const result = await AdminService.createAdmin(adminData);

            res.json({ message: "✅ Admin created successfully!", adminId: result.insertId });
        } catch (error) {
            console.error("❌ Error creating admin:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
    listAdmins: async (req, res) => {
        try {
            const { pagesize, offset, search } = req.query;
            const admins = await AdminService.listAdmins(pagesize, offset, search);
            res.json(admins);
        } catch (error) {
            console.error("❌ Error listing admins:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
    deleteAdmin: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await AdminService.deleteAdmin(id);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "❌ Admin not found" });
            }
            res.json({ message: "✅ Admin deleted successfully" });
        } catch (error) {
            console.error("❌ Error deleting admin:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
    getAdmin: async (req, res) => {
        try {
            const { id } = req.params;
            const admin = await AdminService.getAdmin(id);
            if (!admin) {
                return res.status(404).json({ message: "❌ Admin not found" });
            }
            res.json(admin);
        } catch (error) {
            console.error("❌ Error getting admin:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
    updateAdmin: async (req, res) => {
        try {
            const { id } = req.params;
            const { username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits } = req.body;

            if (!username || typeof username !== "string") {
                return res.status(400).json({ message: "❌ Username is required and must be a string." });
            }

            if (!password || typeof password !== "string") {
                return res.status(400).json({ message: "❌ Password is required and must be a string." });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password.toString(), 10);

            const adminData = { username, password: hashedPassword, email, app_id, app_certificate, channel_name, token_id, adminlimits };

            // Call service function to update admin
            const result = await AdminService.updateAdmin(id, adminData);

            res.json({ message: "✅ Admin updated successfully!" });
        }
        catch (error) {
            console.error("❌ Error updating admin:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },
    loginAdmin: async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ message: '❌ username and password are required' });
            }

            const admin = await AdminService.loginAdmin(username);

            if (!admin) {
                return res.status(401).json({ message: '❌ No Admin found with this username' });
            }

            const isMatch = await bcrypt.compare(password, admin.password);

            if (!isMatch) {
                return res.status(401).json({ message: '❌ Incorrect password' });
            }

            // 🔥 Generate JWT Token
            const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '72h' });

            res.json({ message: '✅ Login successful!', token, id: admin.id, username: admin.username, email: admin.email, app_id: admin.app_id, app_certificate: admin.app_certificate, channel_name: admin.channel_name, token_id: admin.token_id, adminlimits: admin.adminlimits });
        } catch (error) {
            console.error("❌ Error logging in admin:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
};

module.exports = AdminController;
