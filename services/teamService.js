const db = require('../config/db');


const TeamService = {
    createTeam: async (teamData) => {
        return new Promise((resolve, reject) => {
            const { name, email, username, password, admin_id, mobilenumber } = teamData;

            const sql = `INSERT INTO team (name,email, username, password, admin_id, mobilenumber) VALUES (?, ?, ?, ?, ?, ?)`;

            db.query(sql, [name, email, username, password, admin_id, mobilenumber], (err, result) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    },
    listTeams: async (pagesize, offset, search) => {
        return new Promise((resolve, reject) => {
            let sql, queryParams;

            // Convert pagesize and offset to integers
            const parsedPagesize = parseInt(pagesize, 10) || 10;
            const parsedOffset = parseInt(offset, 10) || 0;

            // Check if search is empty, null, undefined, or literal ''
            if (!search || search === "''" || search === '""' || search === '') {
                // If no search term, don't filter by team_name
                sql = `SELECT * FROM team LIMIT ? OFFSET ?`;
                queryParams = [parsedPagesize, parsedOffset];
            } else {
                // If search term exists, filter by team_name
                sql = `SELECT * FROM team WHERE team_name LIKE ? LIMIT ? OFFSET ?`;
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
    deleteTeam: async (teamId) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM team WHERE id = ?`;
            db.query(sql, [teamId], (err, result) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    },
    getTeam: async (teamId) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM team WHERE id = ?`;
            db.query(sql, [teamId], (err, results) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                resolve(results);
            });
        });
    },
    loginTeam: async (username) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM team WHERE username = ?`;
            db.query(sql, [username], (err, results) => {
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
    updateTeam: async (teamId, teamData) => {
        return new Promise((resolve, reject) => {
            const { name, email, username, password, admin_id, mobilenumber } = teamData;

            const sql = `UPDATE team SET name = ?, email = ?, username = ?, password = ?, admin_id = ?, mobilenumber = ? WHERE id = ?`;

            db.query(sql, [name, email, username, password, admin_id, mobilenumber, teamId], (err, result) => {
                if (err) {
                    console.error("Database Error:", err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    }
};

module.exports = TeamService;