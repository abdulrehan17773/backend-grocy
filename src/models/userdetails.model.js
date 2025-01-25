import mongoose, {Schema} from "mongoose";
// import aggregatePaginate from "mongoose-aggregate-paginate-v2";

// const userdetailSchema = new Schema({
//     uaer: {
//         type: String,
//         ref: "User",
//         required: true,
//         index: true
//     },
//     ,
// }, {timestamps: true});

// plugin mongoose-aggregate-pipeline
// userdetailSchema.plugin(aggregatePaginate);

export const Userdetail = mongoose.model("Userdetail", userdetailSchema);