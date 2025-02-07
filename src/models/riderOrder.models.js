import mongoose, {Schema} from "mongoose";

const riderOrderSchema = Schema({
    rider_id: {
        type: String,
        ref: "Rider",
        index: true
    },
    order_id: {
        type: String,
        ref: "Order",
        index: true
    },
    status: {
        type: String,
        enum: ['fetching', 'pickup', 'onway', 'delivered', 'cancelled'],
        default: 'fetching'
    },
    area_id: {
        type: Schema.Types.ObjectId,
        ref: "SubCity",
        required: true,
        index: true
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