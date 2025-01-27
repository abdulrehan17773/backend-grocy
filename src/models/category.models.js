import mongoose, {Schema} from "mongoose";

const catSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    img: {
        type: String,
        required: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})

export const Category = mongoose.model("Category", catSchema)