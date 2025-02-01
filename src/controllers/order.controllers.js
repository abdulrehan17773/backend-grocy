import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"
import { Order } from "../models/order.models.js"
import { OrdersDetails } from "../models/orderDetails.models.js"
import { Product } from "../models/product.models.js"
import { SubCity } from "../models/subCity.models.js"
import { City } from "../models/city.models.js"
import mongoose from "mongoose";



const placeOrder = asyncHandler(async (req, res) => {
    const { user_id, address, phone, area_id, note, delivery_charges, total_price, cart } = req.body;

    if ([user_id, address, phone, area_id, total_price, cart].some(item => !item)) {
        res.status(400);
        throw new ApiError(400, "All fields are required");
    }

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
        const order = await Order.create([{ user_id, order_id, address, phone, area_id, note,delivery_charges, total_price }], { session }); // Pass the session

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
                    let: { order_id: "$order_id" }, // Define a variable for order_id
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$order_id", "$$order_id"] } ,
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
                        { $unwind: "$product" } // Unwind the product array if needed
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
                                qty: "$$orderDetail.qty", // Access qty from orderDetail
                                price: "$$orderDetail.price" // Access price from orderDetail
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    details: 1,
                    order_id: 1,
                    address: 1,
                    phone: 1,
                    status: 1,
                    total_price: 1,
                    delivery_charges: 1,
                    note: 1,
                    reason: 1,
                    cancelled_by: 1,
                    cancelled_at: 1,
                    createdAt: 1,
                    delivered_time: 1,
                    paid_by: 1,
                    _id: 0
                }
            }
        ]);

        if (!order || order.length === 0) {
            res.status(404);
            throw new ApiError(404, "Order not found");
        }

        res.status(200).json(
            new ApiResponse(200, order[0], "Order fetched successfully") // Access the first element
        );
    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json(new ApiResponse(500, null, "Error fetching order"));
    }
});

export {placeOrder, getOrder, cancelOrder, orderDetails};
