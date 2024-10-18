const winston = require("winston");
const os = require("os");
const fs = require("fs");

const getLocalIpAddress = () => {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
}

const serverOptions = {
    host: getLocalIpAddress(),
    port: process.env.PORT || 5000,
    useHttps: true,
    httpsCertFile: './cert/cert.pem',
    httpsKeyFile: './cert/key.pem',
}

const sslOptions = {
    key: fs.readFileSync(serverOptions.httpsKeyFile).toString(),
    cert: fs.readFileSync(serverOptions.httpsCertFile).toString()
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.cli(),
    defaultMeta: { service: 'nest-calls' },
    transports: [
        new winston.transports.Console()
    ]
});

module.exports = { sslOptions, serverOptions, logger, getLocalIPAddress: getLocalIpAddress }