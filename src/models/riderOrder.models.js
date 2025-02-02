import mongoose, {Schema} from "mongoose";

const riderOrderSchema = Schema({
    rider_id: {
        type: Schema.Types.ObjectId,
        ref: "Rider",
        unique: true,
        index: true
    },
    order_id: {
        type: Schema.Types.ObjectId,
        ref: "Order",
        unique: true,
        index: true
    },
    status: {
        type: String,
        enum: ['fetching', 'delivered', 'cancelled'],
        default: 'fetching'
    },
    totalAmount: {
        type: Number,
        required: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})

export const RiderOrder = mongoose.model("RiderOrder", riderOrderSchema);