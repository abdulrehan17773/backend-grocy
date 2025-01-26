import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.models.js"
import { Useraddress } from "../models/userAddress.model.js"
import { ApiError } from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"


const createUserAddress = asyncHandler( async (req, res) => {
    res.status(200).json(
        new ApiResponse(200, null, "address created successfully")
    )
})

export { createUserAddress }
