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

        res.status(200).json(new ApiResponse(200, {email, password}, "Rider created successfully"));

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

const isActive = asyncHandler(async (req, res) => {
    const { user_id } = req.body;

    const rider = await Rider.findOne({ $and: [{ user_id }, { deletedAt: null }] });

    if( !rider){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    let status = rider.is_active;

    rider.is_active = !status;
    rider.is_online = false;
    const updated = await rider.save({validateBeforeSave: false});

    if( !updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, null, "Status updated successfully")
    )

});

const updateCardBack = asyncHandler(async (req, res) => {
    const { user_id } = req.body;
    
    const rider = await Rider.findOne({ $and: [{ user_id }, { deletedAt: null }] });

    if( !rider){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    const oldCardBack = rider.idCardBack;

    const idCardBack = req.file;

    if( !idCardBack || !idCardBack.path){
        res.status(400);
        throw new ApiError(400, "Please upload an image");
    }

    const upload = await handleUploadFile(idCardBack.path);

    if( !upload) {
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    rider.idCardBack = upload.url;
    const updated = await rider.save({validateBeforeSave: false});

    if(!updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    await deleteFileFromCloudinary(oldCardBack);

    res.status(200).json(
        new ApiResponse(200, null, "Card back updated successfully")
    )

});

const updateCardFront = asyncHandler(async (req, res) => {
    const { user_id } = req.body;
    const rider = await Rider.findOne({ $and: [{ user_id }, { deletedAt: null }] });

    if( !rider){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    const oldCardFront = rider.idCardFront;

    const idCardFront = req.file;

    if( !idCardFront || !idCardFront.path){
        res.status(400);
        throw new ApiError(400, "Please upload an image");
    }

    const upload = await handleUploadFile(idCardFront.path);

    if( !upload) {
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    rider.idCardFront = upload.url;
    const updated = await rider.save({validateBeforeSave: false});

    if(!updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    await deleteFileFromCloudinary(oldCardFront);

    res.status(200).json(
        new ApiResponse(200, null, "Card Front updated successfully")
    )
});

const updateLicenseFront = asyncHandler(async (req, res) => {
    const { user_id } = req.body;

    const rider = await Rider.findOne({ $and: [{ user_id }, { deletedAt: null }] });

    if( !rider){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    const oldlicenseFront = rider.licenseFront;

    const licenseFront = req.file;

    if( !licenseFront || !licenseFront.path){
        res.status(400);
        throw new ApiError(400, "Please upload an image");
    }

    const upload = await handleUploadFile(licenseFront.path);

    if( !upload) {
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    rider.licenseFront = upload.url;
    const updated = await rider.save({validateBeforeSave: false});

    if(!updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    await deleteFileFromCloudinary(oldlicenseFront);
    

    res.status(200).json(
        new ApiResponse(200, null, "License Front updated successfully")
    )
});

const updateLicenseBack = asyncHandler(async (req, res) => {
    const { user_id } = req.body;

    const rider = await Rider.findOne({ $and: [{ user_id }, { deletedAt: null }] });

    if( !rider){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    const oldlicenseBack = rider.licenseBack;

    const licenseBack = req.file;

    if( !licenseBack || !licenseBack.path){
        res.status(400);
        throw new ApiError(400, "Please upload an image");
    }

    const upload = await handleUploadFile(licenseBack.path);

    if( !upload) {
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    rider.licenseBack = upload.url;
    const updated = await rider.save({validateBeforeSave: false});

    if(!updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    await deleteFileFromCloudinary(oldlicenseBack);

    res.status(200).json(
        new ApiResponse(200, null, "License back updated successfully")
    )
});

const switchSession = asyncHandler(async (req, res) => {
    const { uid } = req.user;

    const rider = await Rider.findOne({ $and: [{ user_id: uid }, { deletedAt: null }] });

    if( !rider){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    if( !rider.is_active){
        res.status(400);
        throw new ApiError(400, "Rider is not active");
    }

    const status = rider.is_online;

    rider.is_online = !status;
    const updated = await rider.save({validateBeforeSave: false});

    if( !updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, null, "Session Updated successfully")
    )
}
);

const updateRider = asyncHandler(async (req, res) => {
    const {user_id, name, phone, address } = req.body;

    if( !name || !phone || !address) {
        res.status(400);
        throw new ApiError(400, "All fields are required");
    }

    const rider = await Rider.findOne({ $and: [{ user_id }, { deletedAt: null }] });

    if( !rider){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    rider.name = name;
    rider.phone = phone;
    rider.address = address;
    const updated = await rider.save({validateBeforeSave: false});

    if( !updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, null, "Rider updated successfully")
    )
})

const getRiders = asyncHandler(async (req, res) => {
    const { page = 1 } = req.body;
    const limit = 10;

    const aggregate = Rider.aggregate([
        {
            $match: {
                deletedAt: null
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "uid",
                as: "user"
            }
        },
        {
            $unwind: "$user"
        },
        {
            $addFields: {
                email: "$user.email"
            }
        },
        {
            $project: {
                user: 0,
                __v: 0,
                updatedAt: 0,
                deletedAt: 0,
                _id: 0,
                idCardFront: 0,
                idCardBack: 0,
                licenseFront: 0,
                licenseBack: 0
            }
        }
    ])

    const result = await Rider.aggregatePaginate(aggregate, {page: parseInt(page), limit: parseInt(limit)});

    const newData = {
        totalDocs: result.totalDocs,
        limit: result.limit,
        page: result.page,
        totalPages: result.totalPages,
        pagingCounter: result.pagingCounter,
        hasPrevPage: result.hasPrevPage,
        hasNextPage: result.hasNextPage,
        prevPage: result.prevPage,
        nextPage: result.nextPage
    }

    res.status(200).json(
        new ApiResponse(200, {data: result.docs, newData}, "Riders fetched successfully")
    )
});

export { createRider, isActive, updateCardBack, updateCardFront, updateLicenseFront, updateLicenseBack, switchSession, updateRider, getRiders } 