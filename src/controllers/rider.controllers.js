import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User } from "../models/user.models.js";
import { Rider } from "../models/rider.models.js";
import { handleUploadFile, deleteFileFromCloudinary } from "../utils/cloudinary.js";
import { RiderOrder } from "../models/riderOrder.models.js";
import { Order } from "../models/order.models.js";
import { Shift } from "../models/shift.models.js";
import { Setting } from "../models/setting.models.js";
import mongoose from "mongoose";
import sendEmail from "../utils/email.js";



    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0); // Set to the beginning of the day

    // Calculate the start of the last three days
    const threeDaysAgo = new Date(startOfDay);
    threeDaysAgo.setDate(startOfDay.getDate() - 3);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999); // Set to the end of the day
    
    function formatMilliseconds(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
    
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function calculateDailyOnlineTime(onlinePeriods) {
        let totalDailyTime = 0;
    
        if (onlinePeriods.length === 0) {
            return 0;
        }
    
        const today = new Date();
        today.setHours(0, 0, 0, 0);  // Start of today
    
        for (const period of onlinePeriods) {
            const periodStart = new Date(period.start);
    
            if (periodStart >= today) { // Check if the period is from today
                const periodEnd = period.end ? new Date(period.end) : new Date(); // Use now if ongoing
                totalDailyTime += periodEnd.getTime() - periodStart.getTime();
            }
    
        }
        return Math.floor(totalDailyTime / (60 * 60 * 1000)); // Return time in hours
    
    }

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

    if(rider.is_online){
        rider.is_online = false;

        const shift = await Shift.findOne({
            rider_id: user_id,
            deletedAt: null,
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ createdAt: -1 }).limit(1); // Find the most recent shift today

        shift.end_time = Date.now();
        const updatedShift = await shift.save({ validateBeforeSave: false });

        if (!updatedShift) {
            throw new Error("Failed to update shift"); // Re-throw the error to be caught by the outer try/catch
        }
    }
    const updated = await rider.save({validateBeforeSave: false});

    if( !updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, !status, "Status updated successfully")
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

    const session = await mongoose.startSession(); // Start a Mongoose session
    session.startTransaction(); // Start a transaction

    const rider = await Rider.findOne({ $and: [{ user_id: uid }, { deletedAt: null }] }).session(session);

    if (!rider) {
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    if (!rider.is_active) {
        res.status(400);
        throw new ApiError(400, "Rider is not active");
    }

    const status = rider.is_online;
    
    try {

        if (status) { // Rider is online (ending shift)
            const shift = await Shift.findOne({
                rider_id: uid,
                deletedAt: null,
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            }).sort({ createdAt: -1 }).limit(1).session(session); // Find the most recent shift today

            if (!shift) {
                res.status(400);
                throw new ApiError(400, "No active shift found for today"); // More specific error
            }

            shift.end_time = Date.now();
            const updatedShift = await shift.save({ validateBeforeSave: false, session });

            if (!updatedShift) {
                throw new Error("Failed to update shift"); // Re-throw the error to be caught by the outer try/catch
            }

        } else { // Rider is offline (starting shift)
            const newShift = new Shift({ rider_id: uid, start_time: Date.now() }); // Create Shift document
            const createdShift = await newShift.save({ session });

            if (!createdShift) {
                throw new Error("Failed to create new shift"); // Re-throw the error
            }
        }

        rider.is_online = !status;
        const updatedRider = await rider.save({ validateBeforeSave: false, session });

        if (!updatedRider) {
            throw new Error("Failed to update rider status"); // Re-throw the error
        }

        await session.commitTransaction(); // Commit the transaction
        session.endSession();

        res.status(200).json(
            new ApiResponse(200, !status, "Session Updated successfully")
        );

    } catch (innerError) {
        await session.abortTransaction(); // Rollback if any error in the inner try block
        session.endSession();
        console.error("Transaction error:", innerError);  // Log the error for debugging
        res.status(500);
        throw new ApiError(500, "Something went wrong during session update"); // Generic error message
    }
});

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

const pickupOrder = asyncHandler(async (req, res) => {
    const { order_id } = req.body;

    const riderOrder = await RiderOrder.findOne({ $and: [{ order_id }, { deletedAt: null }, {status: 'fetching' }] });

    if( !riderOrder){
        res.status(404);
        throw new ApiError(404, "Order not found");
    }

    const order = await Order.findOne({$and: [{ order_id }, { deletedAt: null }, {status: 'ready' }]})
    
    if( !order){
        res.status(404);
        throw new ApiError(404, "Order not found");
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        order.status = 'pickup';
        order.pickup_time = Date.now();
        const orderSave = await order.save({ validateBeforeSave: false, session });

        riderOrder.status = 'pickup';
        const riderOrderSave = await riderOrder.save({ validateBeforeSave: false, session });

        if( !orderSave || !riderOrderSave){
            await session.abortTransaction();
            session.endSession();
            res.status(500);
            throw new ApiError(500, "Something went wrong")
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json(
            new ApiResponse(200, null, "Order Pickup successfully")
        )
    } catch (error) {
        console.log(error);
        await session.abortTransaction();
        session.endSession();
        res.status(500);
        throw new ApiError(500, "Something went wrong")

    }
})

const onwayOrder = asyncHandler(async (req, res) => {
    const { order_id } = req.body;

    const riderOrder = await RiderOrder.findOne({ $and: [{ order_id }, { deletedAt: null }, {status: 'pickup' }] });

    if( !riderOrder){
        res.status(404);
        throw new ApiError(404, "Order not found");
    }

    const order = await Order.findOne({$and: [{ order_id }, { deletedAt: null }, {status: 'pickup' }]})
    
    if( !order){
        res.status(404);
        throw new ApiError(404, "Order not found");
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        order.status = 'onway';
        order.onway_time = Date.now();
        const orderSave = await order.save({ validateBeforeSave: false, session });

        riderOrder.status = 'onway';
        const riderOrderSave = await riderOrder.save({ validateBeforeSave: false, session });

        if( !orderSave || !riderOrderSave){
            await session.abortTransaction();
            session.endSession();
            res.status(500);
            throw new ApiError(500, "Something went wrong")
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json(
            new ApiResponse(200, null, "Order onway successfully")
        )
    } catch (error) {
        console.log(error);
        await session.abortTransaction();
        session.endSession();
        res.status(500);
        throw new ApiError(500, "Something went wrong")

    }
})

const deliveredOrder = asyncHandler(async (req, res) => {
    const { order_id } = req.body;

    const riderOrder = await RiderOrder.findOne({ $and: [{ order_id }, { deletedAt: null}, {status: 'onway'}]})

    if( !riderOrder){
        res.status(404);
        throw new ApiError(404, "Order not found");
    }

    const order = await Order.findOne({ $and: [{ order_id }, { deletedAt: null}, {status: 'onway'}]})

    if( !order){
        res.status(404);
        throw new ApiError(404, "Order not found");
    }
    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        order.status = 'delivered';
        order.delivery_time = Date.now();
        const orderSave = await order.save({ validateBeforeSave: false, session })

        riderOrder.status = 'delivered';
        riderOrder.totalAmount = order.total_price;
        const riderOrderSave = await riderOrder.save({ validateBeforeSave: false, session });

        if( !orderSave || !riderOrderSave){
            await session.abortTransaction();
            session.endSession();
            res.status(500);
            throw new ApiError(500, "Something went wrong")
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json(
            new ApiResponse(200, null, "Order delivered successfully")
        )
    } catch (error) {
        console.log(error);
        await session.abortTransaction();
        session.endSession();
        res.status(500);
        throw new ApiError(500, "Something went wrong")

    }
})

const riderTime = asyncHandler(async (req, res) => {
    const { uid } = req.user;

    try {
        const rider = await Rider.findOne({ $and: [{ user_id: uid }, { deletedAt: null }] });

        if (!rider) {
            res.status(404);
            throw new ApiError(404, "Rider not found");
        }

        const shifts = await Shift.find({
            rider_id: uid,
            deletedAt: null,
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ createdAt: 1 }); // Sort by start time

        let totalOnlineTime = 0;

        if (shifts.length > 0) {
            for (const shift of shifts) {
                const startTime = shift.start_time.getTime();
                const endTime = shift.end_time ? shift.end_time.getTime() : Date.now();

                totalOnlineTime += endTime - startTime;
            }
        }

        const formattedTotalOnlineTime = formatMilliseconds(totalOnlineTime);

        res.status(200).json(new ApiResponse(200, {
            formattedTotalOnlineTime
        }, "Rider time retrieved successfully"));

    } catch (error) {
        console.error("Error getting rider time:", error);
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }
});

const adminriderTime = asyncHandler(async (req, res) => {
    const {rider_id, date } = req.body;

    if(!rider_id){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }
    try {
        const rider = await Rider.findOne({ $and: [{ user_id: rider_id }, { deletedAt: null }] });

        if (!rider) {
            res.status(404);
            throw new ApiError(404, "Rider not found");
        }


        const targetDate = date ? new Date(date) : new Date();
        if (isNaN(targetDate)) {
            res.status(400);
            throw new ApiError(400, "Invalid date format. Please use YYYY-MM-DD.");
        }

        const startDay = new Date(targetDate);
        startDay.setHours(0, 0, 0, 0);

        const endDay = new Date(targetDate);
        endDay.setHours(23, 59, 59, 999);


        const shifts = await Shift.find({
            rider_id,
            deletedAt: null,
            createdAt: { $gte: startDay, $lte: endDay }
        }).sort({ createdAt: 1 }); // Sort by start time

        let totalOnlineTime = 0;
        const onlinePeriods = [];

        if (shifts.length > 0) {
            for (const shift of shifts) {
                const startTime = shift.start_time.getTime();
                const endTime = shift.end_time ? shift.end_time.getTime() : Date.now();

                totalOnlineTime += endTime - startTime;
                onlinePeriods.push({ start: shift.start_time, end: shift.end_time || null }); // Include end time or null if ongoing
            }
        }

        const formattedTotalOnlineTime = formatMilliseconds(totalOnlineTime);

        res.status(200).json(new ApiResponse(200, {
            formattedTotalOnlineTime,
            onlinePeriods
        }, "Rider time retrieved successfully"));

    } catch (error) {
        console.error("Error getting rider time:", error);
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }
});

const getpreTime = asyncHandler(async (req, res) => {
    const { rider_id } = req.body; // Remove page and limit

    if (!rider_id) {
        res.status(400);
        throw new ApiError(400, "Rider ID is required");
    }

    try {
        const rider = await Rider.findOne({ $and: [{ user_id: rider_id }, { deletedAt: null }] });

        if (!rider) {
            res.status(404);
            throw new ApiError(404, "Rider not found");
        }

        const currentDate = new Date();
        const startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 40); // 40 days ago
        startDate.setHours(0, 0, 0, 0);

        const shifts = await Shift.find({
            rider_id,
            deletedAt: null,
            createdAt: { $gte: startDate, $lte: currentDate } // Limit to last 40 days
        }).sort({ createdAt: 1 }); // No pagination

        const dailyData = {};
        let totalOnlineTime = 0;

        if (shifts.length > 0) {
            for (const shift of shifts) {
                const startTime = shift.start_time.getTime();
                const endTime = shift.end_time ? shift.end_time.getTime() : Date.now();

                totalOnlineTime += endTime - startTime;

                const shiftDate = new Date(shift.createdAt);
                const formattedDate = shiftDate.toISOString().split('T')[0];

                if (!dailyData[formattedDate]) {
                    dailyData[formattedDate] = {
                        totalDailyTime: 0,
                        status: false,
                    };
                }

                dailyData[formattedDate].totalDailyTime += endTime - startTime;
            }
        }

        const formattedTotalOnlineTime = formatMilliseconds(totalOnlineTime);

        const shiftTimeSetting = await Setting.findOne({ key: "shift_time" });
        const requiredShiftTime = shiftTimeSetting ? shiftTimeSetting.value : 9;

        for (const date in dailyData) {
            const dailyTimeInHours = Math.floor(dailyData[date].totalDailyTime / (60 * 60 * 1000));
            dailyData[date].totalDailyTime = formatMilliseconds(dailyData[date].totalDailyTime);
            dailyData[date].status = dailyTimeInHours >= requiredShiftTime;
        }

        // Ensure exactly 40 days of data (with dummy data if needed)
        const allDates = [];
        for (let i = 0; i < 40; i++) {
            const date = new Date(currentDate);
            date.setDate(currentDate.getDate() - i);
            allDates.push(date.toISOString().split('T')[0]);
        }

        const completeDailyData = {};
        allDates.forEach(date => {
            if (dailyData[date]) {
                completeDailyData[date] = dailyData[date];
            } else {
                completeDailyData[date] = {
                    totalDailyTime: "00:00:00",
                    status: false
                };
            }
        });

        res.status(200).json(new ApiResponse(200, {
            dailyData: completeDailyData
        }, "Rider time retrieved successfully"));

    } catch (error) {
        console.error("Error getting rider time:", error);
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }
});

const getRiderOrders = asyncHandler(async (req, res) => {
    const { uid } = req.user;

    const rider = await Rider.findOne({ user_id: uid, deletedAt: null });

    if (!rider) {
        throw new ApiError(404, "Rider not found");
    }

    const orders = await RiderOrder.aggregate([
        {
            $match: {
                rider_id: uid,
                deletedAt: null,
                status: { $in: ['fetching', 'pickup', 'onway'] },
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            }
        },
        {
            $lookup: {
                from: "subcities",
                localField: "area_id",
                foreignField: "_id",
                as: "area"
            }
        },
        {
            $lookup: {  // Lookup against the "orders" collection
                from: "orders",
                localField: "order_id", // Assuming you have order_id in RiderOrder
                foreignField: "order_id",
                as: "order"
            }
        },
        { $unwind: "$order" }, // Unwind the "order" array
        {
            $addFields: {
                area_name: "$area.name",
                order_status: "$order.status" // Add the order status
            }
        },
        {
            $project: {
                area: 0,
                __v: 0,
                updatedAt: 0,
                deletedAt: 0,
                _id: 0,
                rider_id: 0,
                area_id: 0,
                status: 0,
                totalAmount: 0,
                pickup_time: 0,
                order: 0, // Exclude the entire "order" document
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        }
    ]);

    if (!orders || orders.length === 0) {
        return res.status(404).json(new ApiResponse(404, null, "No orders found"));
    }

    res.status(200).json(new ApiResponse(200, orders, "Orders fetched successfully"));
});

const getRiderhistory = asyncHandler(async (req, res) => {
    const {uid} = req.user;

    const rider = await Rider.findOne({ $and: [{ user_id: uid }, { deletedAt: null }] });

    if( !rider){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    const orders = await RiderOrder.aggregate([
        {
            $match: {
                rider_id: uid,
                deletedAt: null,
                status: { $in: ['delivered', 'cancelled'] },
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            }
        },
        {
            $project: {
                __v: 0,
                updatedAt: 0,
                deletedAt: 0,
                _id: 0,
                rider_id: 0,
                area_id: 0,
                pickup_time: 0,
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        }
    ])

    if( !orders || orders.length === 0){
        return res.status(404).json(
            new ApiResponse(404, null, "No orders found")
        )
    }

    res.status(200).json(
        new ApiResponse(200, orders, "Orders fetched successfully")
    )

})

const getSingleOrder = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { uid } = req.user;

    if (!order_id) {
        throw new ApiError(400, "Order ID is required");
    }

    const order = await RiderOrder.findOne({ order_id, rider_id: uid, deletedAt: null });

    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    const orderDetails = await Order.aggregate([
        { $match: { order_id, deletedAt: null } },
        {
            $lookup: {
                from: 'ordersdetails',
                let: { order_id: "$order_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$order_id", "$$order_id"] } } },
                    {
                        $lookup: {
                            from: "products",
                            localField: "pro_id",
                            foreignField: "_id",
                            as: "product"
                        }
                    },
                    { $unwind: "$product" }, // Unwind after initial product lookup
                    {
                        $lookup: {  // Sub-pipeline to get unit name
                            from: "units", // Assuming your units collection is named "units"
                            localField: "product.unit_id",
                            foreignField: "_id",
                            as: "unit"
                        }
                    },
                    { $unwind: { path: "$unit", preserveNullAndEmptyArrays: true } }, // Important: Handle cases where unit_id might be null
                    {
                        $project: {
                            name: "$product.name",
                            img: "$product.img",
                            qty: 1,
                            unit_name: "$unit.name" // Add unit name to the output. Handle the case where unit is null.
                        }
                    }
                ],
                as: 'orderDetails'
            }
        },
        {
            $project: {
                __v: 0,
                updatedAt: 0,
                deletedAt: 0,
                _id: 0,
                user_id: 0,
                area_id: 0,
                rider_id: 0,
                delivered_charges: 0,
                createdAt: 0,
                reason: 0,
                onway_time: 0,
                ready_time: 0,
                preparing_time: 0,
                cancelled_by: 0
            }
        }
    ]);

    if (orderDetails.length === 0) {
        throw new ApiError(404, "Order details not found");
    }

    res.status(200).json(new ApiResponse(200, orderDetails, "Order fetched successfully"));
});

const adminGerRiderOrders = asyncHandler(async (req, res) => {
    const {rider_id} = req.body

    const rider = await Rider.findOne({ $and: [{ user_id: rider_id }, { deletedAt: null }] });

    if( !rider){
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    const orders = await RiderOrder.aggregate([
        {
            $match: {
                rider_id: rider_id,
                deletedAt: null,
                createdAt: { $gte: threeDaysAgo, $lte: endOfDay }
            }
        },
        {
            $project: {
                __v: 0,
                updatedAt: 0,
                deletedAt: 0,
                _id: 0,
                rider_id: 0,
                area_id: 0,
                pickup_time: 0,
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        }
    ])

    if( !orders || orders.length === 0){
        return res.status(404).json(
            new ApiResponse(404, null, "No orders found")
        )
    }

    res.status(200).json(
        new ApiResponse(200, orders, "Orders fetched successfully")
    )

})

export { createRider, isActive, updateCardBack, updateCardFront, updateLicenseFront, updateLicenseBack, switchSession, updateRider, getRiders, pickupOrder, onwayOrder, deliveredOrder, riderTime, adminriderTime, getpreTime, getRiderOrders, getRiderhistory, getSingleOrder, adminGerRiderOrders } 