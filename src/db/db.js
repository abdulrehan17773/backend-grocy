import mongoose from "mongoose";
import { DBName } from "../constants.js";

// write a function to Connect to MongoDB
const connectDb = async () => {
    try {
        const conn = await mongoose.connect(`${process.env.DATABASE_URL}/${DBName}`);
    } catch (error) {
        console.error("Connection Error: ", error);
        process.exit(1);
    }
}

export default connectDb;