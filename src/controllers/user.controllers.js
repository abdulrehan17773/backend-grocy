import { asyncHandler } from "../utils/asyncHandler.js";
import  { User }  from "../models/user.models.js";
import  { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { handleUploadFile } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";


const options = {
    httpOnly: true,
    secure:true    
}

const generateTokens = async (userId) => {
    try {
        // Correct: Use userId directly
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // Generate token here 
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        if (!accessToken || !refreshToken) {
            throw new ApiError(500, "Failed to generate tokens");
        }

        // Save refreshToken
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return {
            accessToken,
            refreshToken
        };
    } catch (error) {
        throw new ApiError(500, "Internal Server Error");
    }
};

const registerUser = asyncHandler( async (req, res) => {
    // Get data from request body
    const { fullname,phone, email, password } = req.body;

    // Check if any of the fields are empty
    if ([fullname, email,phone, password].some(field => !field || field.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // set dummy uid
    const uid = email.toLowerCase();
      

    // Check if user already exists
    const userExists = await User.findOne({email});
    if(userExists){
        res.status(409);
        throw new ApiError(409, "User already exists");
    }

    // create new user
    const createUser = await User.create({uid, fullname, phone, email: email.toLowerCase(), password});

    // check user created successfully ans remove extra data
    const userCreated = await User.findById(createUser._id).select("-password -refreshToken -__v -createdAt -updatedAt -deletedAt -otp -otp_time");
    if(!userCreated){
        res.status(500);
        throw new ApiError(500);
    }
    
    // return success message
    return res.status(200).json(
        new ApiResponse(201, userCreated, "User created successfully")
    )

});

const loginUser = asyncHandler( async (req, res) => {
    const { email, password } = req.body;

    // check if username or email is provided
    if (!email) {
        res.status(400);
        throw new ApiError(400, "email is required");
    }

    // find user
    const userExists = await User.findOne({ email });

    // check if user exists
    if (!userExists) {
        res.status(404);
        throw new ApiError(404, "User not found");
    }

    // match password
    const passwordMatched = await userExists.comparePassword(password);
    if (!passwordMatched) {
        res.status(401);
        throw new ApiError(401, "Invalid password");
    }
    
    // generate tokens 
    const { accessToken, refreshToken } = await generateTokens(userExists._id);

    const loginUser = await User.findById(userExists._id).select("-password -refreshToken -__v -createdAt -updatedAt -deletedAt -otp -otp_time");

    if (!loginUser) {
        res.status(500);
        throw new ApiError(500, "Server error");
    }

    return res.status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(200, { user: loginUser, accessToken, refreshToken }, "User logged in successfully")
        );
});

const logout = asyncHandler( async (req, res) => {

    // delete refreshtoken from database
    User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    // delete refreshtoken from cookie
    return res.status(200)
    .clearCookie("refreshToken", null, options)
    .clearCookie("accessToken", null, options)
    .json(
        new ApiResponse(200, null, "User logged out successfully")
    )
});

const tokenUpdate = asyncHandler( async (req, res) => {  
    
    // get token from cookie
     const oldrefreshToken = req.cookies?.refreshToken || req.header("Authorization")?.replace("Bearer ", "");
     if(!oldrefreshToken){
        res.status(401);
        throw new ApiError(401, "Unauthorized Token");
     }

    //  decode
    const decoded = jwt.verify(oldrefreshToken, process.env.REFRESH_TOKEN_STRING)

    // get user
    const user = await User.findById(decoded?._id);

    if(!user){
        res.status(404);
        throw new ApiError(404, "User not found");
    }

    // verify tokens
    if(user.refreshToken !== oldrefreshToken){
        res.status(401);
        throw new ApiError(401, "Unauthorized Token");
    }

    const { accessToken, refreshToken } = await generateTokens(user._id);

    // send resppnse
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, { accessToken, refreshToken }, "Token updated successfully")
    )

});

const currentUser = asyncHandler( async (req, res) => {
    const user = req.user;

    return res.status(200).json(
        new ApiResponse(200, user, "User fetched successfully")
    )
});

const verifyUser = asyncHandler( async (req, res) => {
    const { otp, email } = req.body;

    if(!otp, !email){
        res.status(400);
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findOne({email});

    if(!user){
        res.status(404);
        throw new ApiError(404, "User not found");
    }

    const otpTime = user.otp_time;
    const currentTime = Date.now();

    if(currentTime > otpTime){
        res.status(401);
        throw new ApiError(401, "OTP expired");
    }


    if(user.otp != otp){
        console.log(user.otp, otp)
        res.status(401);
        throw new ApiError(401, "Invalid otp");
    }

    user.otp = null;
    user.otp_time = null;
    user.verify = true;
    await user.save({ validateBeforeSave: false });
    
    const updatedUser = await User.findOne({email}).select('-password -refreshToken -__v -createdAt -updatedAt -deletedAt -otp -otp_time');
    
    const {refreshToken, accessToken} = await generateTokens(user._id);
    
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {updatedUser, accessToken, refreshToken }, "Token updated successfully")
    )
    
});

const resendOtp = asyncHandler( async (req, res) => {
    const { email } = req.body;

    if(!email){
        res.status(400);
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findOne({email});

    if(!user){
        res.status(400);
        throw new ApiError(400, "User not found");
    }

    const {otp, otp_time} = await user.defineOtp();

    user.otp = otp;
    user.otp_time = otp_time;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, null, "OTP sent successfully")
    )
});

const updateName = asyncHandler( async (req, res) => {
    const {fullname} = req.body;
    const user = req.user;
    if(!fullname){
        res.status(400);
        throw new ApiError(400, "Enter your name");
    } 

    if(user.fullname === fullname){
        res.status(400);
        throw new ApiError(400, "Please enter different name");
    }

    user.fullname = fullname;
    await user.save({validateBeforeSave: false})

    return res.status(200).json(
        new ApiResponse(200, user, "Name updated successfully")
    )

});

const updatePhone = asyncHandler( async (req, res) => {
    const {phone} = req.body;
    const user = req.user;
    if(!phone){
        res.status(400);
        throw new ApiError(400, "Enter your Phone");
    } 

    if(user.phone === phone){
        res.status(400);
        throw new ApiError(400, "Please enter different phone");
    }

    user.phone = phone;
    await user.save({validateBeforeSave: false})

    return res.status(200).json(
        new ApiResponse(200, user, "Phone updated successfully")
    )

});


export { registerUser, loginUser, logout, tokenUpdate, currentUser, verifyUser, resendOtp, updateName, updatePhone };