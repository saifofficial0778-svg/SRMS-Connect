const UserService=require('./userManagement.service')
const catchAsync=require('../../utils/catchAsync');
const { success } = require('zod');
const { updateUserStatus } = require('./userManagement.repository');

const UserController = {

    getUsers: catchAsync(async (req, res) => {
        const { role, status, search, page, limit } = req.validatedQuery;

        const users = await UserService.getUsers(
            { role, status, search },
            page,
            limit
        );

        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: users
        });
    }),

    getUserById:catchAsync(async (req,res)=>{
        const {id}=req.params

        const result=await UserService.getUserById(id)

        return res.status(200).json({
            success:true,
            message: "User fetched successfully",
            data:result
        })

    }),

    updateUserStatus:catchAsync(async(req,res)=>{
        const {id}=req.params
        const {status}=req.body

        const result=await UserService.updateUserStatus(id,status)

        return res.status(200).json({
            success:true,
            message: "status updated successfully",
            data:result
        })
        
    })

};

module.exports = UserController;