import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"
import { Order } from "../models/order.models.js"
import { OrdersDetails } from "../models/orderDetails.models.js"
import { User } from "../models/user.models.js"
import { Product } from "../models/product.models.js"
import { SubCity } from "../models/subCity.models.js"
import { City } from "../models/city.models.js"
import { RiderOrder } from "../models/riderOrder.models.js"
import { Rider } from "../models/rider.models.js"
import { Payment } from "../models/payment.models.js"
import mongoose from "mongoose";


const checkRider = async (order_id, area_id, totalAmount = 0) => {
    const existingOrder = await RiderOrder.findOne({ order_id, deletedAt: null });
    if (existingOrder) {
        return true; // Order already assigned
    }

    const riders = await Rider.find({ is_online: true, is_active: true, deletedAt: null });

    const riderOrderCounts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    for (const rider of riders) {

        const orderCount = await RiderOrder.countDocuments({
            rider_id: rider.user_id,
            deletedAt: null,
            status: { $nin: ['delivered', 'cancelled'] },
            createdAt: { $gte: today }
        });
        
        const fetchingOrPickupCount = await RiderOrder.countDocuments({
            rider_id: rider.user_id,
            deletedAt: null,
            status: { $in: ['fetching', 'pickup'] },
            createdAt: { $gte: today }
        });

        console.log(orderCount, fetchingOrPickupCount)

        if(orderCount > 0 && fetchingOrPickupCount > 0){
            riderOrderCounts.push({ rider, count: orderCount });
        } else if(orderCount == 0){
            riderOrderCounts.push({ rider, count: orderCount });
        }
    }
    riderOrderCounts.sort((a, b) => a.count - b.count);
    console.log(riderOrderCounts)
    // 1. Try to assign to riders with matching area_id:
    for (const { rider, count } of riderOrderCounts) {
        if (count <= 3) { // Capacity check combined
            const existingRiderOrders = await RiderOrder.find({ rider_id: rider.user_id, deletedAt: null, status: { $in: ['fetching', 'pickup'] } });
            for (const order of existingRiderOrders) {
                if (order.area_id.equals(new mongoose.Types.ObjectId(area_id))) { // Correct ObjectId comparison
                    const newOrder = await RiderOrder.create({ rider_id: rider.user_id, order_id, status: 'fetching', area_id, totalAmount });
                    if (newOrder) {
                        return true;
                    }
                }
            }
        }
    }

    // 2. If NO rider with matching area_id is found, assign to ANY rider with capacity (0-3):
    for (const { rider, count } of riderOrderCounts) {
        if (count <= 3) { // Check capacity (0 to 3 orders)
            const newOrder = await RiderOrder.create({ rider_id: rider.user_id, order_id, status: 'fetching', area_id, totalAmount });
            if (newOrder) {
                return true;
            }
        }
    }

    return false; // No suitable rider found
};

const placeOrder = asyncHandler(async (req, res) => {
    const {address, phone, area_id, note, delivery_charges, total_price, cart } = req.body;
    const {uid} = req.user;

    if ([address, phone, area_id, total_price, cart].some(item => !item)) {
        res.status(400);
        throw new ApiError(400, "All fields are required");
    }

    const userData = await User.findOne({uid, deletedAt: null}).select('fullname');

    if( !userData){
        res.status(404);
        throw new ApiError(404, "User not found");
    }

    const user_id = uid;
    const username = userData.fullname;

    const order_id = "ORD_" + (Date.now().toString(36) + Math.random().toString(36)).slice(11, 18);


    const area = await SubCity.findOne({ _id: area_id, is_active: true, deletedAt: null });
    
    if (!area) {
        res.status(404);
        throw new ApiError(404, "We're currently closed in this area");
    }
    
    const city = await City.findOne({ _id: area.city_id, is_active: true, deletedAt: null });
    
    if (!city) {
        res.status(404);
        throw new ApiError(404, "We're currently closed in this City");
    }

    // Start a Mongoose session for the transaction
    const session = await mongoose.startSession();
    session.startTransaction(); // Start the transaction

    try {
        const order = await Order.create([{ user_id, username, order_id, address, phone, area_id, note,delivery_charges, total_price }], { session }); // Pass the session

        if (!order || order.length === 0) { // Check if order creation failed
            await session.abortTransaction();
            session.endSession();
            res.status(500);
            throw new ApiError(500, "Failed to create order"); // More specific error message
        }

        const orderDetails = [];
        for (const item of cart){
            const { pro_id, qty } = item;
            const product = await Product.findById(item.pro_id);
            if (!product || product.deletedAt || !product.is_active) {
                throw new ApiError(404, "Product not found");
            }
            if (qty < 1) {
                throw new ApiError(402, "Qty must be 1 or more");
            }
            orderDetails.push({ order_id: order[0].order_id, pro_id, qty, price: product.discount_price }); // Use order[0].order_id
        }

        await OrdersDetails.insertMany(orderDetails, { session }); // Pass the session

        await session.commitTransaction(); // Commit the transaction
        session.endSession();

        res.status(200).json(new ApiResponse(200, null, "Order placed successfully"));
    } catch (error) {
        await session.abortTransaction(); // Rollback the transaction on error
        session.endSession();
        console.error("Error placing order:", error); // Log the error for debugging
        res.status(500);
        throw new ApiError(500, "Something went wrong placing the order"); // Generic error message for the client
    }

});

const getOrder = asyncHandler(async (req, res) => {
    const { uid } = req.user;
    const { page = 1, status } = req.body; // Get page and limit from req.body
    const limit = 12;
    
    let getStatus = {status: status};
    if( !status){
        getStatus = {};
    }

    const aggregate = Order.aggregate([ // Store the aggregation pipeline
        {
            $match: {
                $and: [{ user_id: uid }, { deletedAt: null }, getStatus]
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                order_id: 1,
                address: 1,
                phone: 1,
                status: 1,
                total_price: 1,
                _id: 0 // Exclude _id for cleaner response
            }
        }
    ]);

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
    };

    try {
        const result = await Order.aggregatePaginate(aggregate, options);

        const responseData = { // Combine data and pagination info
            orders: result.docs,
            totalDocs: result.totalDocs,
            limit: result.limit,
            page: result.page,
            totalPages: result.totalPages,
            pagingCounter: result.pagingCounter,
            hasPrevPage: result.hasPrevPage,
            hasNextPage: result.hasNextPage,
            prevPage: result.prevPage,
            nextPage: result.nextPage
        };

        res.status(200).json(
            new ApiResponse(200, responseData, "Order fetched successfully") // Send combined data
        );
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json(new ApiResponse(500, null, "Error fetching orders"));
    }
});

const cancelOrder = asyncHandler(async (req, res) => {
    const { uid } = req.user;
    const {order_id, reason} = req.body;

    if( !order_id ){
        res.status(400);
        throw new ApiError(400, "Missing Data")
    }

    const order = await Order.findOne({$and: [{user_id:uid}, {order_id}, {deletedAt: null}]});
  
    if(!order) {
        res.status(404);
        throw new ApiError(404, "Order not found")
    }

    if(order.status != 'pending'){
        res.status(400);
        throw new ApiError(400, 'Order cannot be cancelled')
    }

    order.status = 'cancelled';
    order.reason = reason || '' ;
    order.cancelled_by = 'user';
    order.cancelled_at = Date.now();
    const updated = await order.save({validateBeforeSave: false});

    if( !updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, null, "Order cancelled successfully")
    )

});

const orderDetails = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { uid } = req.user;

    if (!order_id) {
        res.status(400);
        throw new ApiError(400, "Missing Data");
    }

    try {
        const order = await Order.aggregate([
            {
                $match: {
                    $and: [{ user_id: uid }, { order_id }, { deletedAt: null }]
                }
            },
            {
                $lookup: {
                    from: "ordersdetails",
                    let: { order_id: "$order_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$order_id", "$$order_id"] },
                                deletedAt: null
                            }
                        },
                        {
                            $lookup: {
                                from: "products",
                                localField: "pro_id",
                                foreignField: "_id",
                                as: "product"
                            }
                        },
                        { $unwind: "$product" }
                    ],
                    as: "orderDetails"
                }
            },
            {
                $addFields: {
                    details: {
                        $map: {
                            input: "$orderDetails",
                            as: "orderDetail",
                            in: {
                                name: "$$orderDetail.product.name",
                                img: "$$orderDetail.product.img",
                                qty: "$$orderDetail.qty",
                                price: "$$orderDetail.price"
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "riderorders",
                    let: { order_id: "$order_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$order_id", "$$order_id"] },
                                deletedAt: null,
                                status: { $nin: ["cancelled", "delivered"] }
                            }
                        },
                        {
                            $lookup: {
                                from: "riders",
                                localField: "rider_id",
                                foreignField: "user_id",
                                as: "riderDetails"
                            }
                        },
                        { $unwind: { path: "$riderDetails", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 0,
                                name: "$riderDetails.name",
                                phone: "$riderDetails.phone",
                            }
                        }
                    ],
                    as: "rider"
                }
            },
            { $unwind: { path: "$rider", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    details: 1,
                    order_id: 1,
                    address: 1,
                    phone: 1,
                    status: 1,
                    total_price: 1,
                    delivered_charges: 1,
                    note: 1,
                    reason: 1,
                    cancelled_by: 1,
                    cancelled_at: 1,
                    createdAt: 1,
                    delivered_time: 1,
                    paid_by: 1,
                    rider: 1,
                    _id: 0
                }
            }
        ]);

        if (!order || order.length === 0) {
            res.status(404);
            throw new ApiError(404, "Order not found");
        }

        res.status(200).json(new ApiResponse(200, order[0], "Order fetched successfully"));

    } catch (error) {
        console.error("Error fetching order:", error); // Log the error for debugging
        res.status(500).json(new ApiResponse(500, null, "Error fetching order")); // Consistent JSON error response
    }
});

const preparingOrder = asyncHandler(async (req, res) => {
    const { order_id } = req.body;

    if( !order_id){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const order = await Order.findOne({$and: [{order_id}, {deletedAt: null}]});

    if( !order){
        res.status(404);
        throw new ApiError(404, "Order not found")
    }

    order.status = 'preparing';
    order.preparing_time = Date.now();
    await order.save({validateBeforeSave: false});
    
    const algo = await checkRider(order_id, order.area_id);

    let line = "Order preparing successfully"
    if( !algo) {
        line = "Status update, please dispatch to rider"
    }
    
    res.status(200).json(
        new ApiResponse(200, null, line)
    )

     
}) 

const readyOrder = asyncHandler(async (req, res) => {
    const { order_id } = req.body;

    if( !order_id){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const order = await Order.findOne({$and: [{order_id}, {deletedAt: null}]});

    if( !order){
        res.status(404);
        throw new ApiError(404, "Order not found")
    }

    if(order.status == 'pending'){
        res.status(400);
        throw new ApiError(400, "Order is not preparing")
    }

    order.status = 'ready';
    order.ready_time = Date.now();
    await order.save({validateBeforeSave: false});

    
    const algo = await checkRider(order_id, order.area_id);

    let line = "Order ready successfully"
    if( !algo) {
        line = "Status update, please dispatch to rider"
    }

    res.status(200).json(
        new ApiResponse(200, null, line)
    )
     
})

const rejectOrder = asyncHandler(async (req, res) => {
    const { order_id, reason } = req.body;

    if( !order_id || !reason){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const order = await Order.findOne({$and: [{order_id}, {deletedAt: null},{ status: { $ne: 'delivered' }}]});

    if( !order){
        res.status(404);
        throw new ApiError(404, "Order not found")
    }

    if (order.status === 'cancelled'){
        res.status(400);
        throw new ApiError(400, "Order is already cancelled")
    }

    order.status = 'cancelled';
    order.reason = reason;
    order.cancelled_by = 'admin';
    order.cancelled_at = Date.now();

    const rider = await RiderOrder.findOne({$and: [{order_id}, {deletedAt: null}]});

    if(rider){
        rider.status = 'cancelled';

        const riderpayment = await rider.save({validateBeforeSave: false});

        if( !riderpayment){
            res.status(500);
            throw new ApiError(500, "Something went wrong")
        }
    }
    await order.save({validateBeforeSave: false});

    res.status(200).json(
        new ApiResponse(200, null, "Order cancelled successfully")
    )
})

const updateRider = asyncHandler(async (req, res) => {
    const { order_id, pre_rider, rider_id } = req.body;
    
    if( !order_id || !rider_id){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }
    
    if( pre_rider == rider_id){
        res.status(400);
        throw new ApiError(400, "Rider cannot be same")
    }

    const order = await Order.findOne({$and: [{order_id}, {deletedAt: null}]});

    if(!order || order.status != 'cancelled' || order.status != 'delivered'){
        res.status(404);
        throw new ApiError(404, "Order not found")
    }

    const rider = await Rider.findOne({$and: [{user_id: rider_id}, {deletedAt: null}]});

    if(!rider){
        res.status(404);
        throw new ApiError(404, "New Rider not found")
    }

    if(!rider.is_online || !rider.is_active){
        res.status(400);
        throw new ApiError(400, "Order is not active or online");
    }

    if(pre_rider){
        const prevRider = await RiderOrder.findOne({$and: [{order_id}, {rider_id: pre_rider}, {deletedAt: null}]});

        if(!prevRider){
            res.status(404);
            throw new ApiError(404, "Previous Rider not found")
        }

        prevRider.deletedAt = Date.now();
        const updated = await prevRider.save({validateBeforeSave: false});
        if( !updated){
            res.status(500);
            throw new ApiError(500, "Something went wrong")
        }
    }

    const newOrder = await RiderOrder.create({order_id, rider_id, status: 'fetching', area_id: order.area_id, totalAmount: order.total_price});

    if( !newOrder){
        res.status(500);
        throw new ApiError(500, "Something went wrong");
    }

    res.status(200).json(
        new ApiResponse(200, newOrder, "Rider updated successfully")
    )
})

const adminGetAllOrder = asyncHandler(async (req, res) => {
    const {page = 1, status, limit = 10} = req.body;

    let newStatus = {status: status};
    if( !status){
        newStatus = {}
    }

    const aggregate = Order.aggregate([ // Store the aggregation pipeline
        {
            $match: {
                $and: [{ deletedAt: null },  newStatus ]
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                order_id: 1,
                address: 1,
                phone: 1,
                status: 1,
                total_price: 1,
                _id: 0 // Exclude _id for cleaner response
            }
        }
    ])

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
    };

    const result = await Order.aggregatePaginate(aggregate, options);

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
        new ApiResponse(200, {data: result.docs, newData}, "Order fetched successfully")
    )
})

const adminOrderDetails = asyncHandler(async (req, res) => {
    const { order_id } = req.params;

    if (!order_id) {
        throw new ApiError(400, "Order ID is required");
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
                    { $unwind: "$product" },
                    {
                        $lookup: {
                            from: "units",
                            localField: "product.unit_id",
                            foreignField: "_id",
                            as: "unit"
                        }
                    },
                    { $unwind: { path: "$unit", preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: 0, // Project _id out here at the earliest stage
                            name: "$product.name",
                            img: "$product.img",
                            qty: 1, // You might want to get this from ordersdetails
                            unit_name: "$unit.name",
                            product_id: "$product._id" // Include product_id if needed
                        }
                    }
                ],
                as: 'orderDetails'
            }
        },
        {
            $lookup: {
                from: 'riderorders',
                let: { order_id: "$order_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$order_id", "$$order_id"] }
                        }
                    },
                    {
                        $lookup: {
                            from: 'riders',
                            localField: 'rider_id',
                            foreignField: 'user_id',
                            as: 'riderDetails'
                        }
                    },
                    { $unwind: { path: '$riderDetails', preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: 0,
                            name: '$riderDetails.name',
                            rider_id: '$riderDetails.user_id',
                            phone: '$riderDetails.phone',
                        }
                    }
                ],
                as: 'riderorder'
            }
        },
        { $unwind: { path: "$riderorder", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                __v: 0,
                updatedAt: 0,
                deletedAt: 0,
                _id: 0, // Project _id out here
                user_id: 0,
                area_id: 0,
                createdAt: 0,
            }
        }
    ]);

    if (orderDetails.length === 0) {
        throw new ApiError(404, "Order details not found");
    }

    res.status(200).json(new ApiResponse(200, orderDetails[0], "Order fetched successfully")); // Send the first element since it's an array
});

const clearOrderPayments = asyncHandler(async (req, res) => {
    const { order_id, amount } = req.body;

    if (!order_id || !amount) {
        res.status(400);
        throw new ApiError(400, "Missing Data");
    }

    const order = await Order.findOne({ $and: [{ order_id }, { deletedAt: null }] });

    if (!order) {
        res.status(404);
        throw new ApiError(404, "Order not found");
    }

    const riderOrder = await RiderOrder.findOne({ $and: [{ order_id }, { status: 'delivered' }, { deletedAt: null }] });

    if (!riderOrder) {
        res.status(404);
        throw new ApiError(404, "Rider not found");
    }

    if (riderOrder.totalAmount < amount) {
        res.status(401);
        throw new ApiError(401, "Insufficient amount");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        
        const finalAmount = riderOrder.totalAmount - amount;
        riderOrder.totalAmount = finalAmount;
        
        const paid = await riderOrder.save({ session, validateBeforeSave: false });
        
        if (!paid) {
            res.status(500);
            throw new ApiError(500, "Something went wrong saving the rider order"); // More specific error message
        }

        const payment = await Payment.create([{ order_id, rider_id: riderOrder.rider_id , amount}]);

        if( !payment){
            res.status(500);
            throw new ApiError(500, "Something went wrong creating the payment")
        }
        
        await session.commitTransaction();  
        session.endSession();

        res.status(200).json(
            new ApiResponse(200, finalAmount, "Payment cleared successfully")
        );
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Transaction Error:", error); // Log the actual error for debugging
        res.status(500);
        throw new ApiError(500, "Something went wrong during payment clearing"); // More general error message
    }
});

const getorderPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.body; // No order_id needed here

    try {
        const aggregate = Payment.aggregate([
            { $match: { deletedAt: null } },
            { $project: { _id: 0, updatedAt: 0, deletedAt: 0, __v: 0 } }
        ]);


        const result = await Payment.aggregatePaginate(aggregate, {
            page: parseInt(page),
            limit: parseInt(limit),
        });


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
        };

        res.status(200).json(
            new ApiResponse(200, { data: result.docs, newData }, "Payments fetched successfully")
        );

    } catch (error) {
        console.error("Aggregation Error:", error);
        res.status(500);
        throw new ApiError(500, "Error fetching payments");
    }
});

export {placeOrder, getOrder, cancelOrder, orderDetails, preparingOrder, readyOrder, rejectOrder, updateRider, adminGetAllOrder, adminOrderDetails, clearOrderPayments, getorderPayments};
