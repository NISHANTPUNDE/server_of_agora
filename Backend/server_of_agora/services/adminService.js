const db = require('../config/db'); // Import your MySQL connection

const AdminService = {
    createAdmin: async (adminData) => {
        return new Promise((resolve, reject) => {
            console.log("admin data", adminData);
            const { username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits, name } = adminData;
    
            // First, check if the username already exists
            const checkSql = `SELECT username FROM admin WHERE username = ?`;
    
            db.query(checkSql, [username], (err, results) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                if (results.length > 0) {
                    // Username already exists, return an error
                    return reject({ message: "❌ Username not available. Please use another username." });
                }
    
                // If username doesn't exist, proceed with insertion
                const insertSql = `INSERT INTO admin (username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits, name) 
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
                db.query(insertSql, [username, password, email, app_id, app_certificate, channel_name, token_id, adminlimits, name], (err, result) => {
                    if (err) {
                        console.error("Database Error:", err);
                        return reject(err);
                    }
                    resolve(result);
                });
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
        console.log(adminData)
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];
    
            Object.entries(adminData).forEach(([key, value]) => {
                fields.push(`${key} = ?`);
                values.push(value);
            });
    
            if (fields.length === 0) {
                return reject(new Error("No fields provided for update."));
            }
    
            values.push(adminId); // Add ID for WHERE condition
            const sql = `UPDATE admin SET ${fields.join(", ")} WHERE id = ?`;
    
            db.query(sql, values, (err, result) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    },
    
    loginAdmin: async (username) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM admin WHERE username = ?`;
            db.query(sql, [username], (err, results) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                if (results.length === 0) {
                    return resolve(null);
                }
                resolve(results[0]);
                console.log(results[0]);
            });
        });
    },
};

module.exports = AdminService;
