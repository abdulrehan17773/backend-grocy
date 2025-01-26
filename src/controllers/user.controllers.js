import { asyncHandler } from "../utils/asyncHandler.js";
import  { User }  from "../models/user.models.js";
import  { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { handleUploadFile, deleteFileFromCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import sendEmail from "../utils/email.js";


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

    await sendEmail(userCreated.email, `Account Verification ${createUser.otp}`, `Sign-up successfully! Your OTP is ${createUser.otp}`)

    
    // return success message
    return res.status(200).json(
        new ApiResponse(201, userCreated, "User created successfully")
    )

});

const loginUser = asyncHandler( async (req, res) => {
    const { email, password } = req.body;

    // check if username or email is provided
    if (!email || !password) {
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

    if(userExists.verify == false){
        res.status(200).json(
        new ApiResponse(200, null, "Verification required")
        )
        return;
    }
    
    // generate tokens 
    const { accessToken, refreshToken } = await generateTokens(userExists._id);

    const loginUser = await User.findById(userExists._id).select("-password -refreshToken -__v -createdAt -updatedAt -deletedAt -otp -otp_time");

    if (!loginUser) {
        res.status(500);
        throw new ApiError(500, "Server error");
    }

    await sendEmail(loginUser.email, `Login`, `Login successfully!`)

    return res.status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(200, { user: loginUser, accessToken, refreshToken }, "User logged in successfully")
        );
});

const logout = asyncHandler(async (req, res) => {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { refreshToken: null } },
        { new: true }
      );
  
      if (!updatedUser) {
        return res.status(404).json(new ApiResponse(404, null, "User not found"));
      }
  
      res.status(200)
        .clearCookie("refreshToken", null, options)
        .clearCookie("accessToken", null, options)
        .json(new ApiResponse(200, null, "User logged out successfully"));
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json(new ApiResponse(500, null, "Failed to log out"));
    }
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
        new ApiResponse(200, {updatedUser, accessToken, refreshToken }, "Token verification successfully")
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
    
    await sendEmail(user.email, `Resend  OTP ${user.otp}`, `Your OTP is ${user.otp}`)

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

const updateAvatar = asyncHandler( async (req, res) => {
    const user = req.user;
    const avatar = req.file;
    const oldavatar = user.avatar;
    if(!avatar){
        res.status(400);
        throw new ApiError(400, "Please upload an image");
    }
    
    const uploadedavatar = await handleUploadFile(avatar.path);

    if(!uploadedavatar){
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    user.avatar = uploadedavatar.url;
    const updated = await user.save({validateBeforeSave: false})
    
    if(!updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    if(oldavatar != "logo.png"){
        
        await deleteFileFromCloudinary(oldavatar);
    }
    
    res.status(200).json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )

});

const updatePassword = asyncHandler( async (req, res) => {
    const {oldPassword, newPassword} = req.body;
    const user = req.user;

    if(!oldPassword || !newPassword){
        res.status(400);
        throw new ApiError(400, "All fields are required");
    }
    
    if(oldPassword == newPassword){
        res.status(400);
        throw new ApiError(400, "Please enter different password");
    }
    
    const newUser = await User.findById(user._id);
    const passwordMatched = await newUser.comparePassword(oldPassword);
    
    if(!passwordMatched){
        res.status(401);
        throw new ApiError(401, "Invalid password");
    }
    const {refreshToken, accessToken} = await generateTokens(user._id);

    newUser.password = newPassword;
    newUser.refreshToken = refreshToken;
    await newUser.save({validateBeforeSave: false})

    const updatedUser = await User.findById(newUser._id).select("-password -refreshToken -__v -createdAt -updatedAt -deletedAt -otp -otp_time");


    await sendEmail(updatedUser.email, `Change Password`, `Your password Updated successfully!`)
    
    
    res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {updatedUser,accessToken, refreshToken}, "Password updated successfully")
    )

});

const sendForgetPassword = asyncHandler( async (req, res) => {
    const {email} = req.body;
    
    if(!email){
        res.status(400);
        throw new ApiError(400, "Please enter your email")
    }
    
    const user = await User.findOne({email});
    if(!user){
        res.status(404);
        throw new ApiError(404, "User not found");
    }
    
    const {otp, otp_time} = await user.defineOtp();
    
    user.otp = otp;
    user.otp_time = otp_time;
    await user.save({ validateBeforeSave: false });
    
    await sendEmail(user.email, `Forget Password`, `Update your password using this link http://127.0.0.1:4000/api/v1/users/forget/${user.email}/${user.otp}`)
    
    res.status(200).json(
        new ApiResponse(200, null, "Email sent successfully")
    )

});

const checkExpiryForget = asyncHandler( async (req, res) => {
    const {email, token} = req.params;

    if(!email || !token) {
        res.status(400);
        throw new ApiError(400, "missing Data");
    }

    const user = await User.findOne({email});

    if(!user){
        res.status(404);
        throw new ApiError(404, "User not found");
    }

    const currentTime = Date.now();

    if(currentTime > user.otp_time){
        res.status(401);
        throw new ApiError(401, "OTP expired");
    }

    if(user.otp != token){
        res.status(401);
        throw new ApiError(401, "Invalid otp");
    }

    return res.status(200).json(
        new ApiResponse(200, null, "OTP verified successfully")
    )
});

const forgetPassword = asyncHandler( async (req, res) => {
    const {email,token, oldPassword, newPassword} = req.body;

    if(!oldPassword || !newPassword || !email || !token){
        res.status(400);
        throw new ApiError(400, "Missing Data");
    }
    
    if(oldPassword == newPassword){
        res.status(400);
        throw new ApiError(400, "Please enter different password");
    }
    
    const newUser = await User.findOne({email});

    if(!newUser){
        res.status(404);
        throw new ApiError(404, "User not found");
    }
    const passwordMatched = await newUser.comparePassword(oldPassword);
    
    const currentTime = Date.now();

    if(currentTime > newUser.otp_time){
        res.status(401);
        throw new ApiError(401, "OTP expired");
    }

    if(newUser.otp != token){
        res.status(401);
        throw new ApiError(401, "Invalid otp");
    }

    if(!passwordMatched){
        res.status(401);
        throw new ApiError(401, "Invalid password");
    }

    newUser.password = newPassword;
    newUser.otp = null;
    newUser.otp_time = null;
    newUser.verify = true;
    await newUser.save({validateBeforeSave: false})
    
    await sendEmail(newUser.email, `Change Password`, `Your password Updated successfully!`)

    res.status(200).json(
        new ApiResponse(200, null, "Password updated successfully")
    )
    
});

export { registerUser, loginUser, logout, tokenUpdate, currentUser, verifyUser, resendOtp, updateName, updatePhone, updateAvatar, updatePassword,forgetPassword, sendForgetPassword, checkExpiryForget };