const https = require('https')
const WebSocket = require('ws')
const express = require('express')
const cors = require('cors')
const { sslOptions, serverOptions, logger, getLocalIpAddress } = require("./config")
const { socketOnConnect, socketOnClose, socketOnMessage} = require("./listeners")

const app = express()
app.use(cors({
    origin: 'https://localhost:5173',
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}))
const webServer = https.createServer(sslOptions, app)
const webServerSocket = new WebSocket.Server({ server: webServer })

webServerSocket.on('connection', socket => {
    socketOnConnect(socket)
    socket.on('message', async (message) => socketOnMessage(socket, message))
    socket.on('close', () => socketOnClose(socket))
    socket.on('error', () => socket.terminate())
})

webServerSocket.on('error', (error) => {
    console.error(`WebSocket error: ${error.message}`);
});

webServer.listen(serverOptions, () => {
    const addressInfo = webServer.address();
    logger.log({level: "info", message: `Sockets:   wss://${addressInfo.address}:${addressInfo.port}`})
})

logger.log({level: "info", message: "Server started"})
logger.log({level: "info", message: `Localhost: https://localhost:${serverOptions.port}`})
logger.log({level: "info", message: `LAN:       https://${getLocalIpAddress()}:${serverOptions.port}`})