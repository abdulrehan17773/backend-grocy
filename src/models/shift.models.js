import mongoose, {Schema} from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const shiftSchema = new Schema({
    rider_id:{
        type: String,
        required: true,
        index: true
    },
    start_time:{
        type: Date,
        required: true
    },
    end_time:{
        type: Date,
        default: null
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})

shiftSchema.plugin(aggregatePaginate);

export const Shift = mongoose.model("Shift", shiftSchema);