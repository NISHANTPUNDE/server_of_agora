const mysql = require('mysql2');

const pool = mysql.createPool({
    host: '134.209.146.24',
    user: 'DevEraa',
    password: '@04DevEraa',
    database: 'skai_voice',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


// Check MySQL Connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ MySQL Connection Failed:', err.message);
    } else {
        console.log('✅ MySQL Connected Successfully');
        connection.release(); // Release the connection back to the pool
    }
});

module.exports = pool;