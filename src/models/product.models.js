import mongoose, {Schema} from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const proSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    cost: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    discount_price: {
        type: Number,
        required: true
    },
    cat_id: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
        index: true
    },
    unit_id: {
        type: Schema.Types.ObjectId,
        ref: "Unit",
        required: true,
        index: true
    },
    seller_id: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    qty: {
        type: Number,
        required: true
    },
    is_active: {
        type: Boolean,
        default: false
    },
    is_featured: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        required: true
    },
    img: {
        type: [String],
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