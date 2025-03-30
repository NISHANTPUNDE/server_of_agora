const db = require('../config/db');


const TeamService = {
    // createTeam: async (teamData) => {
    //     return new Promise((resolve, reject) => {
    //         const { name, username, password, admin_id, mobilenumber } = teamData;
    //         console.log(teamData)

    //         const sql = `INSERT INTO team (name, username, password, admin_id, mobilenumber) VALUES (?, ?, ?, ?, ?)`;

    //         db.query(sql, [name, username, password, admin_id, mobilenumber], (err, result) => {
    //             if (err) {
    //                 console.error("Database Error:", err);
    //                 return reject(err);
    //             }
    //             resolve(result);
    //         });
    //     });
    // },


    createTeam: async (teamData) => {
        return new Promise(async (resolve, reject) => {
            console.log("teamData", teamData)
            try {
                // Extract values and provide defaults if missing
                const {
                    name = "",
                    username = "",
                    password = "",
                    confirmPassword = "",
                    mobilenumber = "",
                    email = "",
                    tokenid = "",
                    Channelid = "",
                    appid = "",
                    admin_id = "",
                    createdby = ""
                } = teamData;


                // Ensure password and confirmPassword match
                // if (password !== confirmPassword) {
                //     return reject(new Error("Passwords do not match!"));
                // }

                // Hash the password before storing
                // const hashedPassword = await bcrypt.hash(password, 10);

                // SQL query
                const sql = `INSERT INTO team 
                (admin_id, username, password, status, name, mobilenumber, email, tokenid, Channelid, createdby) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                // Execute query
                db.query(sql,
                    [admin_id, username, password, 1, name, mobilenumber, email, tokenid, Channelid, createdby],
                    (err, result) => {
                        if (err) {
                            // **Check for Duplicate Username Error (ER_DUP_ENTRY - MySQL Error Code 1062)**
                            if (err.code === "ER_DUP_ENTRY") {
                                return reject(new Error("Username already exists!"));
                            }
                            console.error("Database Error:", err);
                            return reject(new Error("Database error occurred!"));
                        }
                        resolve(result);
                    }
                );
            } catch (error) {
                reject(error);
            }
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

    getTeambyadmin: async (createdby) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM team WHERE createdby = ?`;
            db.query(sql, [createdby], (err, results) => {
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

    // updateTeam: async (teamId, teamData) => {
    //     return new Promise((resolve, reject) => {
    //         const { name, email, username, password, admin_id, mobilenumber } = teamData;

    //         const sql = `UPDATE team SET name = ?, email = ?, username = ?, password = ?, admin_id = ?, mobilenumber = ? WHERE id = ?`;

    //         db.query(sql, [name, email, username, password, admin_id, mobilenumber, teamId], (err, result) => {
    //             if (err) {
    //                 console.error("Database Error:", err);
    //                 return reject(err);
    //             }
    //             resolve(result);
    //         });
    //     });
    // }
    updateTeam: async (teamId, teamData) => {
        return new Promise((resolve, reject) => {
            // Extract provided fields from teamData
            const fields = Object.keys(teamData);
            const values = Object.values(teamData);

            if (fields.length === 0) {
                return reject(new Error("No fields provided for update."));
            }

            // Dynamically create SET clause
            const setClause = fields.map((field) => `${field} = ?`).join(", ");

            // SQL query with dynamic fields
            const sql = `UPDATE team SET ${setClause} WHERE id = ?`;

            // Push teamId at the end for the WHERE clause
            values.push(teamId);

            db.query(sql, values, (err, result) => {
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