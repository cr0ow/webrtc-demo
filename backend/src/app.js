const { v4: uuid4 } = require('uuid')
const https = require('https')
const WebSocket = require('ws')
const express = require('express')
const { sslOptions, serverOptions, logger, getLocalIPAddress } = require("./config")
const { peers } = require("./helpers")
const {
    socketOnClose,
    socketOnConnect,
    socketOnConsume,
    socketOnConsumerIce,
    socketOnGetPeers,
    socketOnIce
} = require("./listeners")


const app = express();
const WebSocketServer = WebSocket.Server;
const webServer = https.createServer(sslOptions, app)
webServer.listen(serverOptions)
const webServerSocket = new WebSocketServer({ server: webServer });

const broadcast = message => {
    webServerSocket.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

webServerSocket.on('connection', socket => {
    let peerId = uuid4();
    logger.log({level: "info", message: "New client connected: " + peerId});
    peers.set(peerId, { socket: socket, id: peerId })
    socket.on('close', socket => socketOnClose(socket, broadcast));
    socket.send(JSON.stringify({ 'type': 'welcome', id: peerId }));

    socket.on('message', async (message) => {
        const body = JSON.parse(message);
        logger.log({ level: "info", message: "Received message: '" + body.type + "' from: '" + body.uqid + "'" });
        logger.log({ level: "debug", message: "Message payload: " + JSON.stringify(body) });
        switch (body.type) {
            case 'connect':
                await socketOnConnect(socket, body, broadcast)
                break
            case 'getPeers':
                socketOnGetPeers(socket, body)
                break;
            case 'ice':
                socketOnIce(body)
                break;
            case 'consume':
                await socketOnConsume(socket, body)
                break;
            case 'consumerIce':
                socketOnConsumerIce(body)
                break;
            default:
                broadcast(message);

        }
    });

    socket.on('error', () => socket.terminate());
});

logger.log({level: "info", message: "Server started"});
logger.log({level: "info", message: `Local:   https://localhost:${serverOptions.port}`});
logger.log({level: "info", message: `Network: https://${getLocalIPAddress()}:${serverOptions.port}`});