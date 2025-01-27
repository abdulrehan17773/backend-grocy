import mongoose, {Schema} from "mongoose";

const userAddressSchema = new Schema({
    user_id: {
        type: String,
        ref: "User",
        required: true,
        index: true
    },
    subcity_id: {
        type: String,
        ref: "SubCity",
        required: true,
        index: true
    },
    address: {
        type: String,
        required: true
    },  
    deletedAt:{
        type: Date,
        default: null
    }
}, {timestamps: true});


export const Useraddress = mongoose.model("Useraddress", userAddressSchema);