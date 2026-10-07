const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require("http");
const { Server } = require("socket.io");
require('dotenv').config();

const { getClientOrigins } = require('./src/config/env');
const globalErrorHandler = require('./src/middlewares/errorMiddleware');
const AppError = require('./src/utils/AppError');
const app = express();

// Behind a reverse proxy/load balancer set TRUST_PROXY (e.g. 1) so rate limiting sees real client IPs.
if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

const clientOrigins = getClientOrigins();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: clientOrigins,
        credentials: true
    }
});

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
// Middlewares
app.use(cors({
  origin: clientOrigins,
  credentials: true
}));

const authRoutes=require('./src/modules/auth/auth.route')
const userRoutes=require('./src/modules/userManagement/userManagement.route')
const profileRoutes=require('./src/modules/profile/profile.route')
const postRoutes=require('./src/modules/post/post.route')
const connectionRoutes = require("./src/modules/connection/connection.route");
const chatRoutes = require("./src/modules/chat/chat.route");
const searchRoutes = require("./src/modules/search/search.route");
const notificationRoutes = require("./src/modules/notification/notification.route");
const jobRoutes = require("./src/modules/job/job.route");
const careerRoutes = require("./src/modules/career/career.route");
const insightRoutes = require("./src/modules/insight/insight.route");
const mentorshipRoutes = require("./src/modules/mentorship/mentorship.route");
const introRoutes = require("./src/modules/intro/intro.route");
const analyticsRoutes = require("./src/modules/analytics/analytics.route");
const spotlightRoutes = require("./src/modules/spotlight/spotlight.route");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/career", careerRoutes);
app.use("/api/insights", insightRoutes);
app.use("/api/mentorship", mentorshipRoutes);
app.use("/api/intros", introRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/spotlights", spotlightRoutes);





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
