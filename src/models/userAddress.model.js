import mongoose, {Schema} from "mongoose";
// import aggregatePaginate from "mongoose-aggregate-paginate-v2";

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
    type: {
        type: String,
        required: true
    },  
    deletedAt:{
        type: Date,
        default: null
    }
}, {timestamps: true});

// plugin mongoose-aggregate-pipeline
// userdetailSchema.plugin(aggregatePaginate);

export const Useraddress = mongoose.model("Useraddress", userAddressSchema);