const jwt = require('jsonwebtoken')

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Access Denied: Token missing!" })
    }

    try {
        const verifiedData = jwt.verify(token, process.env.JWT_SECRET)
        req.user = {
            ...verifiedData,
            token
        };
        next()
    } catch (err) {
        return res.status(403).json({ message: "Session expired ya invalid token. Dubara login karo." })
    }
};
module.exports = verifyToken;