import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"
import { User } from "../models/user.models.js"
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

    const orders = await Order.find({ user_id: uid, deletedAt: null }).select("order_id address phone status total_price")

    if( !orders){
        return res.status(200).json(
            new ApiResponse(200, orders, "Order not found"))
    }

    res.status(200).json(
        new ApiResponse(200, orders, "Order fetched successfully")
    )
  
});

export {placeOrder, getOrder};