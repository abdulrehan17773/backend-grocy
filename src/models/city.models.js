import mongoose, {Schema} from "mongoose";

const citySchema = new Schema({
    name:{
        type: String,
        unique: true,
        required: true,
        index: true
    },
    is_active:{
        type: Boolean,
        default: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})

export const City = mongoose.model("City", citySchema);