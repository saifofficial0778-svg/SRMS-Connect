const AuthService = require('../modules/auth/auth.service');
const AppError = require('../utils/AppError');

// Verifies the JWT *and* that its session is still live (not revoked/expired)
// and that the user's account is still ACTIVE.
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next(new AppError("Access Denied: Token missing!", 401));
    }

    try {
        const { userId, role } = await AuthService.authenticateToken(token);
        req.user = { userId, role, token };
        next();
    } catch (err) {
        next(err);
    }
};
module.exports = verifyToken;
