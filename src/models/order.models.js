import mongoose, {Schema} from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";


const orderSchema = new Schema({
    user_id:{
        type: String,
        ref: "User",
        required: true,
        index: true
    },
    order_id:{
        type: String,
        required: true,
        unique: true,
        index: true
    },
    address: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    area_id: {
        type: Schema.Types.ObjectId,
        ref: "SubCity",
        required: true,
        index: true
    },
    note: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'preparing', 'ready', 'pickup', 'onway', 'delivered', 'cancelled'],
        default: 'pending'
    },
    preparing_time: {
        type: Date,
        default: null
    },
    ready_time: {
        type: Date,
        default: null
    },
    pickup_time: {
        type: Date,
        default: null
    },
    onway_time: {
        type: Date,
        default: null
    },
    delivered_time: {
        type: Date,
        default: null
    },
    cancelled_by: {
        type: String,
        enum: ['user', 'admin'],
        default: null 
    },
    cancelled_at: {
        type: Date,
        default: null
    },
    reason: {
        type: String,
        default: null
    },
    paid_by: {
        type: String,
        default: null
    },
    delivered_charges: {
        type: Number,
        default: 0
    },
    total_price: {
        type: Number,
        required: true
    },
    deletedAt: {
        type: Date,
        default: null
    }

}, {timestamps: true})

orderSchema.plugin(aggregatePaginate);

export const Order = mongoose.model("Order", orderSchema);