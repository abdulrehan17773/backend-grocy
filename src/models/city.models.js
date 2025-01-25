import mongoose, {Schema} from "mongoose";

const citySchema = new Schema({
    name:{
        type: String,
        ref: "User",
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

export default City = mongoose.model("City", citySchema);