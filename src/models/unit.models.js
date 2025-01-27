import mongoose, {Schema} from "mongoose";

const unitSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})


export const Unit = mongoose.model("Unit", unitSchema); 