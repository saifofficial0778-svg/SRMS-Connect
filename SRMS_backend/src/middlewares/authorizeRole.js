const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        // req.user hume upar wale middleware se milega
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: "You are not authorize for this role!" 
            });
        }
        next();
    };
};

module.exports = authorizeRoles;