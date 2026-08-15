 const validate =(schema)=>{
    return (req,res,next)=>{
        const result = schema.safeParse(req.body)

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: result.error.issues
            });
        }
         req.body = result.data;

        next();
    }
}

const validateQuery = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: result.error.issues
            });
        }

        req.validatedQuery = result.data;
        next();
    };
};

module.exports = {
    validate,
    validateQuery
};