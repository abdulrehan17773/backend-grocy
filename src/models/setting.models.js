import mongoose, {Schema} from "mongoose";

const settingSchema = new Schema({
    admin_id:{
        type: String,
        unique: true,
        required: true,
        index: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})

export const Setting = mongoose.model("Setting", settingSchema);