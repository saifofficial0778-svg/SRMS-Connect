const AuthService = require("./auth.service");
const catchAsync=require('../../utils/catchAsync')

const AuthController = {

    register: catchAsync(async (req, res) => {

        const user= await AuthService.register(req.body)
        return res.status(201).json({
            success:true,
            message:"user create successfully",
            data:user
        })
    }),

};

module.exports = AuthController;