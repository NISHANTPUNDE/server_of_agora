
require('dotenv').config();
const { Client } = require('ssh2');
const net = require('net');
const mysql = require('mysql2');

let pool;

const server = net.createServer(function (socket) {
    console.log('Client connected');

    const sshClient = new Client();

    sshClient.on('ready', function () {
        console.log('SSH Connection: ready');

        sshClient.forwardOut(
            process.env.MYSQL_HOST || '127.0.0.1',
            0,
            process.env.MYSQL_HOST || '127.0.0.1',
            parseInt(process.env.MYSQL_PORT) || 3306,
            function (err, stream) {
                if (err) {
                    console.error('SSH Forwarding error:', err);
                    socket.end();
                    return;
                }

                console.log('SSH stream established');

                socket.pipe(stream);
                stream.pipe(socket);

                stream.on('close', function () {
                    console.log('SSH stream closed');
                    sshClient.end();
                });
            }
        );
    });

    sshClient.on('error', function (err) {
        console.error('SSH Connection error:', err.message);
        socket.end();
    });

    socket.on('error', function (err) {
        console.error('Socket error:', err.message);
        sshClient.end();
    });

    sshClient.connect({
        host: process.env.SSH_HOST,
        port: parseInt(process.env.SSH_PORT),
        username: process.env.SSH_USER,
        password: process.env.SSH_PASSWORD,
        debug: process.env.NODE_ENV !== 'production'
    });
});

const localPort = parseInt(process.env.MYSQL_LOCAL_PORT) || 3307;

server.listen(localPort, process.env.MYSQL_HOST || '127.0.0.1', function () {
    console.log(`Listening on port ${localPort}`);

    pool = mysql.createPool({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: localPort,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0
    });

    // Test the connection
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('❌ MySQL Connection Failed:', err.message);
        } else {
            console.log('✅ MySQL Connected Successfully via SSH tunnel');
            connection.release();
        }
    });
});

server.on('error', function (err) {
    console.error('Server error:', err.message);
});

module.exports = {
    getPool: function () {
        return pool;
    },
    closeAll: function () {
        if (pool) pool.end();
        server.close();
    },
    query: function (...args) {
        if (!pool) {
            throw new Error('Database connection not established yet');
        }
        return pool.query(...args);
    }
};