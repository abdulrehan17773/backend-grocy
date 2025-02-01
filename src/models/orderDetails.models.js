import mongoose, {Schema} from "mongoose";

const orderDetailsSchema = new Schema({
    order_id:{
        type: String,
        ref: "Order",
        required: true,
        index: true
    },
    pro_id:{
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true
    },
    qty: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})

export const OrdersDetails = mongoose.model("OrdersDetails", orderDetailsSchema);