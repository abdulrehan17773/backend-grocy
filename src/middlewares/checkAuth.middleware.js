import { asyncHandler } from "../utils/asyncHandler.js";
import  { User }  from "../models/user.models.js";
import  { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";

const grocyRole = ['user', 'admin', 'rider']

const checkAuth = asyncHandler( async(req, _, next) => {

    // get token
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    if(!token){
        throw new ApiError(401, "Unauthorized token");
    }

    // decode the token
    const {uid} = jwt.verify(token, process.env.ACCESS_TOKEN_STRING)
    // get user
    const user = await User.findOne({uid}).select("-password -refreshToken -__v -createdAt -updatedAt -deletedAt -otp -otp_time");

    if(!user){
        throw new ApiError(401, "Unauthorized");
    }

    // set user for next
    req.user = user;
    next();
});

const checkAdmin = asyncHandler( async(req, _, next) => {

    // get token
    const {role} = req.user
    if(!role){
        throw new ApiError(401, "Unauthorized");
    }

    const admin = role.indexOf('admin');

    if(admin < 0){
        throw new ApiError(401, "Unauthorized");
    }

    next();
});

const checkRider = asyncHandler( async(req, _, next) => {

    // get token
    const {role} = req.user
    if(!role){
        throw new ApiError(401, "Unauthorized");
    }

    const rider = role.indexOf('rider');

    if(rider < 0){
        throw new ApiError(401, "Unauthorized");
    }

    next();
});

export { checkAuth, checkAdmin, checkRider };