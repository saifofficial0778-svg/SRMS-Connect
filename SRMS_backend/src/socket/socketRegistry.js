// Shared between socket.js and any REST controller that needs to push a
// real-time event (e.g. chat.controller's markRead notifying the sender
// their message was seen). Avoids creating a second, disconnected
// onlineUsers map.

const onlineUsers = new Map();
let ioInstance = null;

module.exports = {
    onlineUsers,
    setIo: (io) => {
        ioInstance = io;
    },
    getIo: () => ioInstance,
};
