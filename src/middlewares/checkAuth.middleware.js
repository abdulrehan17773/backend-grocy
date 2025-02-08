import { asyncHandler } from "../utils/asyncHandler.js";
import  { User }  from "../models/user.models.js";
import { Rider } from "../models/rider.models.js";
import { Setting } from "../models/setting.models.js";
import  { ApiError } from "../utils/ApiError.js";
import { Shift } from "../models/shift.models.js";
import jwt from "jsonwebtoken";

const checkLogin = asyncHandler( async(req, _, next) => {

    // get token
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    
    if(token){
        throw new ApiError(401, "User already logged in");
    }

    next();
});

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
    const {uid} = req.user
    
    const verifyAdmin = await Setting.findOne({$and: [{admin_id: uid},{deletedAt: null}]});

    if(!verifyAdmin){
        throw new ApiError(401, "Unauthorized")
    }

    next();
});

const checkRider = asyncHandler( async(req, _, next) => {

    // get token
    const {uid} = req.user
    
    const verifyRider = await Rider.findOne({$and: [{user_id: uid},{deletedAt: null}]});
    if(!verifyRider){
        throw new ApiError(401, "Unauthorized")
    }

    next();
});

const checkRiderSession = asyncHandler( async(req, _, next) => {
    // get token
    const {uid, role} = req.user;

    if (!role.includes('rider')) { // Check if 'rider' is in the role array
        return next(); // Use return to exit early
    }

    const verifyRider = await Rider.findOne({$and: [{user_id: uid},{deletedAt: null}]});

    if(!verifyRider){
        throw new ApiError(401, "Unauthorized")
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0); // Set to the beginning of the day
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999); // Set to the end of the day
    

    if( verifyRider.is_online){

        const shift = await Shift.findOne({
            rider_id: uid,
            deletedAt: null,
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ createdAt: -1 }).limit(1); // Find the most recent shift today

        if (!shift) {
            throw new ApiError(400, "Something went wrong!"); // More specific error
        }

        shift.end_time = Date.now();
        verifyRider.is_online = false;
        const updatedRider = await verifyRider.save({ validateBeforeSave: false});
        const updatedShift = await shift.save({ validateBeforeSave: false});

        if (!updatedShift || !updatedRider) {
            throw new ApiError(401, "Failed to update shift"); // Re-throw the error to be caught by the outer try/catch
        }
    }

    next();
});

export { checkAuth, checkAdmin, checkRider, checkRiderSession, checkLogin };