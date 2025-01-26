import mongoose, {Schema} from "mongoose";

const subCitySchema = new Schema({
    city_id:{
        type: Schema.Types.ObjectId,
        ref: 'City',
        required: true,
        index: true
    },
    name:{
        type: String,
        required: true
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

export const SubCity = mongoose.model("SubCity", subCitySchema);