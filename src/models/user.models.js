import mongoose, {Schema} from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new Schema({
    uid:{
        type: String,
        unique: true,
        index: true,
        required: true
    },
    fullname: {
        type: String,
        required: true
    },
    email:{
        type: String,
        required: true,
        unique: true,
        tolowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
    },
    password:{
        type: String,
        required: true,
    },
    avatar: {
        type: String, 
        default: "logo.png" 
    },
    verify: {
        type: Boolean,
        default: false
    },
    otp: {
        type: Number,
        default: null
    },
    otp_time: {
        type: Number,
        default: null
    },
    refreshToken: {
        type: String,
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true});

// just before saving the user, hash the password
userSchema.pre("save", async function (next) {

    if(this.isModified("password")){
        // hash the password if password is modified
        this.password = await bcrypt.hash(this.password, 10)
    }
    
    if (this.isNew) {    
        // generate uid for the user
        const addFields = Date.now();
        const uniqueId  = await bcrypt.hash(addFields, 10);
        this.uid = uniqueId.slice(7, 15);

        // generate otp for the user
        const otp = Math.floor(100000 + Math.random() * 900000);
    
        // set otp time for the user
        const otp_time = Date.now() + (15 * 60 * 1000); // 15 minutes in milliseconds

        this.otp = otp;
        this.otp_time = otp_time;
    }
    next();
})

// compare password method
userSchema.methods.comparePassword = async function (password) {

    // return result after compare 
    return await bcrypt.compare(password, this.password);

}


// generate otp and set otp time
userSchema.methods.defineOtp = async function () {

    // generate otp for the user
    const otp = Math.floor(100000 + Math.random() * 900000);
    
    // set otp time for the user
    const otp_time = Date.now() + (15 * 60 * 1000);

    return {otp, otp_time};
}

// generate jwt access token here
userSchema.methods.generateAccessToken = function () {

    // return the jwt access token
    return jwt.sign(
        {
            _id: this._id,
            uid: this.uid,
            fullname: this.phone,
            email: this.email,
        },
            process.env.ACCESS_TOKEN_STRING,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

// generate jwt refresh token here
userSchema.methods.generateRefreshToken = function () {
    
    // return the jwt refresh token
    return jwt.sign(
        {
            _id: this._id,
        },
            process.env.REFRESH_TOKEN_STRING,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}



export const User = mongoose.model("User", userSchema);