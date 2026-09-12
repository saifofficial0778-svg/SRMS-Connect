const express = require('express');
const cors = require('cors'); 
const http = require("http");
const { Server } = require("socket.io");
require('dotenv').config(); 


const globalErrorHandler = require('./src/middlewares/errorMiddleware');
const AppError = require('./src/utils/AppError');  
const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        credentials: true
    }
});

app.use(express.json());
// Middlewares
app.use(cors({
  origin: 'http://localhost:5173', // Tumhaare frontend ka address
  credentials: true 
}));

const authRoutes=require('./src/modules/auth/auth.route')
const userRoutes=require('./src/modules/userManagement/userManagement.route')
const profileRoutes=require('./src/modules/profile/profile.route')
const postRoutes=require('./src/modules/post/post.route')
const connectionRoutes = require("./src/modules/connection/connection.route");
const chatRoutes = require("./src/modules/chat/chat.route");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/chat", chatRoutes);





// 1. Unhandled Routes Catching (Standard '*' use karo)
app.all(/.*/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 2. Global Error Handling Middleware (Sabse aakhiri me)
app.use(globalErrorHandler);

// Port ko process.env se uthao, nahi toh 3000 fallback
const PORT = process.env.PORT || 5000;

const setupSocket = require("./src/socket/socket");

setupSocket(io);

server.listen(PORT, () => {
    console.log(`🚀 SRMS Connect Backend running on port ${PORT}`);
});