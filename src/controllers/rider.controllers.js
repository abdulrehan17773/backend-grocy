import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User } from "../models/user.models.js";
import { Rider } from "../models/rider.models.js";
import { handleUploadFile, deleteFileFromCloudinary } from "../utils/cloudinary.js";



const createRider = asyncHandler( async (req, res) => {
    res.status(200).json(
        new ApiResponse(200, null, "Rider created successfully")
    )
})


export { createRider } 