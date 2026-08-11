module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    // Agar status pehle se nahi hai, toh check karo 4xx hai ya 5xx
    err.status = err.status || (String(err.statusCode).startsWith('4') ? 'fail' : 'error');

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        // Production mode logic
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    }
};