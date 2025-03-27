const db = require('../config/db'); // Import your MySQL connection

const AdminService = {
    createAdmin: async (adminData) => {
        return new Promise((resolve, reject) => {
            const { username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits } = adminData;

            const sql = `INSERT INTO admin (username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

            db.query(sql, [username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits], (err, result) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    },
    listAdmins: async (pagesize, offset, search) => {
        return new Promise((resolve, reject) => {
            let sql, queryParams;

            // Convert pagesize and offset to integers
            const parsedPagesize = parseInt(pagesize, 10) || 10;
            const parsedOffset = parseInt(offset, 10) || 0;

            // Check if search is empty, null, undefined, or literal ''
            if (!search || search === "''" || search === '""' || search === '') {
                // If no search term, don't filter by username
                sql = `SELECT * FROM admin LIMIT ? OFFSET ?`;
                queryParams = [parsedPagesize, parsedOffset];
            } else {
                // If search term exists, filter by username
                sql = `SELECT * FROM admin WHERE username LIKE ? LIMIT ? OFFSET ?`;
                const searchValue = `%${search}%`; // Add wildcards to the search term
                queryParams = [searchValue, parsedPagesize, parsedOffset];
            }

            db.query(sql, queryParams, (err, results) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                resolve(results);
            });
        });
    },
    deleteAdmin: async (adminId) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM admin WHERE id = ?`;
            db.query(sql, [adminId], (err, result) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    },
    getAdmin: async (adminId) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM admin WHERE id = ?`;
            db.query(sql, [adminId], (err, results) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                if (results.length === 0) {
                    return resolve(null);
                }
                resolve(results[0]);
            });
        });
    },
    updateAdmin: async (adminId, adminData) => {
        return new Promise((resolve, reject) => {
            const { username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits } = adminData;

            const sql = `UPDATE admin SET username = ?, password = ?, email = ?, app_id = ?, app_certificate = ?, channel_name = ?, token_id = ?, adminlimits = ? WHERE id = ?`;

            db.query(sql, [username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits, adminId], (err, result) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    }
};

module.exports = AdminService;
