const express = require('express');
const cors = require('cors'); 
require('dotenv').config(); 


const globalErrorHandler = require('./src/middlewares/errorMiddleware');
const AppError = require('./src/utils/AppError');  
const app = express();

// Middlewares
app.use(cors({
  origin: 'http://localhost:5173', // Tumhaare frontend ka address
  credentials: true 
}));
app.use(express.json());

const authRoutes=require('./src/modules/auth/auth.route')
const userRoutes=require('./src/modules/userManagement/userManagement.route')
const profileRoutes=require('./src/modules/profile/profile.route')
const postRoutes=require('./src/modules/post/post.route')

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/posts", postRoutes);





// 1. Unhandled Routes Catching (Standard '*' use karo)
app.all(/.*/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 2. Global Error Handling Middleware (Sabse aakhiri me)
app.use(globalErrorHandler);

// Port ko process.env se uthao, nahi toh 3000 fallback
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 ERP Backend MVC Server running on port ${PORT}`);
});