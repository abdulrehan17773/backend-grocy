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
    console.log(req.body)
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

// request as www-form-urlencoded
const loginUser = asyncHandler( async (req, res) => {
    const { username, email, password } = req.body;

    // check if username or email is provided
    if (!username && !email) {
        res.status(400);
        throw new ApiError(400, "Username or email is required");
    }

    // find user
    const userExists = await User.findOne({ $or: [{ username }, { email }] });

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
            $set: {
                refreshToken: null
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


export { registerUser, loginUser, logout, tokenUpdate};