// Gives REST-side code (e.g. NotificationService) access to the Socket.IO server so it can push
// events to a user without importing the socket setup (which would be a circular dependency).
// Every authenticated socket joins its user's room, so emitting to the room reaches all of
// that user's open tabs.

let ioInstance = null;

const userRoom = (userId) => `user:${Number(userId)}`;

module.exports = {
    userRoom,
    setIo: (io) => {
        ioInstance = io;
    },
    getIo: () => ioInstance,
};
