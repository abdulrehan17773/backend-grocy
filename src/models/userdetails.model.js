import mongoose, {Schema} from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const userdetailSchema = new Schema({
    uid: {
        type: String,
        ref: "User",
        required: true,
        index: true
    },
    phone: {
        type: Number,
        required: true,
        unique: true
    },
    is_loyal: {
        type: Boolean,
        default: false    
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true});

// plugin mongoose-aggregate-pipeline
userdetailSchema.plugin(aggregatePaginate);

export const Userdetail = mongoose.model("Userdetail", userdetailSchema);