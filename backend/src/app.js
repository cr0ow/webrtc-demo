const { v4: uuid4 } = require('uuid')
const https = require('https')
const WebSocket = require('ws')
const express = require('express')
const { sslOptions, serverOptions, logger, getLocalIpAddress } = require("./config")
const { peers } = require("./utils")
const {
    socketOnClose,
    socketOnConnect,
    socketOnSubscribe,
    socketOnProducerIce,
    socketOnGetPeers,
    socketOnIce
} = require("./listeners")


const app = express()
const WebSocketServer = WebSocket.Server
const webServer = https.createServer(sslOptions, app)
webServer.listen(serverOptions)
const webServerSocket = new WebSocketServer({ server: webServer })

const broadcast = message => {
    peers.forEach(peer => {
        if (peer.socket.readyState === WebSocket.OPEN) {
            peer.socket.send(message)
        }
    })
}

webServerSocket.on('connection', socket => {
    socket.id = uuid4()
    logger.log({level: "info", message: "New client connected: " + socket.id})
    peers.set(socket.id, { socket: socket, id: socket.id, subscribedPeers: new Map() })
    socket.on('close', () => socketOnClose(socket.id, broadcast))
    socket.send(JSON.stringify({ 'type': 'welcome', id: socket.id }))

    socket.on('message', async (message) => {
        const body = JSON.parse(message)
        // const id = body.id || body.consumerId
        // console.log(body.type + " from " + id)
        switch (body.type) {
            case 'connect':
                await socketOnConnect(socket, body, broadcast)
                break
            case 'getPeers':
                socketOnGetPeers(socket, body)
                break
            case 'ice':
                socketOnIce(body)
                break
            case 'subscribe':
                await socketOnSubscribe(socket, body)
                break
            case 'producerIce':
                socketOnProducerIce(body.ice, body.consumerId, body.producerId)
                break
            default:
                broadcast(message)
        }
    })

    socket.on('error', () => socket.terminate())
})

logger.log({level: "info", message: "Server started"})
logger.log({level: "info", message: `Localhost: https://localhost:${serverOptions.port}`})
logger.log({level: "info", message: `LAN:       https://${getLocalIpAddress()}:${serverOptions.port}`})