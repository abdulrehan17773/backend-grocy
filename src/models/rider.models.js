import mongoose, {Schema} from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const riderSchema = Schema({
    user_id : {
        type: String,
        ref: "User",
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        default: false
    },
    is_online: {
        type: Boolean,
        default: false
    },
    idCardFront: {
        type: String,
        required: true
    },
    idCardBack: {
        type: String,
        required: true
    },
    licenseFront: {
        type: String,
        required: true
    },
    licenseBack: {
        type: String,
        required: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})

riderSchema.plugin(aggregatePaginate);

export const Rider = mongoose.model("Rider", riderSchema);