import mongoose, { Schema } from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";


const paymentSchema = new Schema({
    order_id: {
        type: String,
        required: true,
    },
    rider_id: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true});


paymentSchema.plugin(aggregatePaginate);
export const Payment = mongoose.model("Payment", paymentSchema);

