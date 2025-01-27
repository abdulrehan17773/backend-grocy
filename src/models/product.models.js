import mongoose, {Schema} from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const proSchema = Schema({
    name: {
        type: String,
        required: true,
        unique: true
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


// plugin mongoose-aggregate-pipeline
proSchema.plugin(aggregatePaginate);

export const Product = mongoose.model("Product", proSchema)