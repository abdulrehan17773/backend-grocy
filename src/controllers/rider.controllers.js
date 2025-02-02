import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User } from "../models/user.models.js";
import { Rider } from "../models/rider.models.js";
import { handleUploadFile, deleteFileFromCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";
import sendEmail from "../utils/email.js";



const createRider = asyncHandler(async (req, res) => {
    const { name, phone, email, address } = req.body;

    if (!name || !phone || !email || !address) {
        res.status(400);
        throw new ApiError(400, "All fields are required");
    }

    const password = Math.random().toString(36).slice(-8);
    const uid = email.toLowerCase();

    const existingUser = await User.findOne({ $and: [{ email }, { deletedAt: null }] });

    if (existingUser) {
        res.status(400);
        throw new ApiError(400, "User already exists");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const uploadedFiles = {};
    try {
        const img = req.files;
        const requiredFields = ['avatar', 'idCardFront', 'idCardBack', 'licenseFront', 'licenseBack'];
        const filesToDelete = [];

        const missingFields = requiredFields.filter(field => !img[field]);

        if (missingFields.length > 0) {
            res.status(400);
            throw new ApiError(400, `Missing required image`);
        }

        for (const field of requiredFields) {
            const file = img[field][0];
            filesToDelete.push(file.path);
            try {
                const cloudinaryResponse = await handleUploadFile(file.path);
                if (cloudinaryResponse) {
                    uploadedFiles[field] = cloudinaryResponse.url;
                } else {
                    throw new Error("Cloudinary upload failed");
                }
            } catch (uploadError) {
                throw new Error("Cloudinary upload failed");
            }
        }

        const addUser = await User.create([{ fullname:name, phone, email: email.toLowerCase(), uid, password, role: ["user", "rider"], avatar: uploadedFiles.avatar }], { session });
        if (!addUser) {
            await session.abortTransaction();
            res.status(500);
            throw new ApiError(500, "User creation failed");
        }

        const addRider = await Rider.create([{ user_id: addUser[0].uid, name, phone, address, idCardFront: uploadedFiles.idCardFront, idCardBack: uploadedFiles.idCardBack, licenseFront: uploadedFiles.licenseFront, licenseBack: uploadedFiles.licenseBack }], { session });
        if (!addRider) {
            await session.abortTransaction();
            res.status(500);
            throw new ApiError(500, "Rider creation failed");
        }

        await sendEmail(email, `Set Your Password`, `Set your password using this link http://127.0.0.1:4000/api/v1/users/forget/${email}/${addUser[0].otp}`)
        
        await session.commitTransaction();
        session.endSession();

        res.status(200).json(new ApiResponse(200, null, "Rider created successfully"));

    } catch (error) {
        console.error("Error during create rider:", error);
        await session.abortTransaction();
        session.endSession();
        if (uploadedFiles || Object.keys(uploadedFiles).length > 0) {   
            for (const [key, value] of Object.entries(uploadedFiles)) {
                await deleteFileFromCloudinary(value);
            }
        }

        res.status(500);
        throw new ApiError(500, "Something went wrong during rider creation");
    }
});


export { createRider } 