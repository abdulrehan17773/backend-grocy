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
    username:{
        type: String,
        unique: true,
        tolowercase: true,
        trim: true,
        default: null
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
    password:{
        type: String,
        required: true,
    },
    avatar: {
        type: String, // cloudinary image url
        default: "logo.png" // default image
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

    if (this.isNew) {    
        // hash the password
        this.password = await bcrypt.hash(this.password, 10);

        // generate uid for the user
        const uniqueId = this._id + this.email;
        const longUid  = await bcrypt.hash(uniqueId, 10);
        this.uid = longUid.slice(7, 15);

        // generate otp for the user
        const otp = Math.floor(100000 + Math.random() * 900000);
        this.otp = otp;
        
        // set otp time for the user
        this.otp_time = Date.now() + 1000;
    }
    next();

})

// compare password method
userSchema.methods.comparePassword = async function (password) {

    // return result after compare 
    return await bcrypt.compare(password, this.password);

}

// generate jwt access token here
userSchema.methods.generateAccessToken = function () {

    // return the jwt access token
    return jwt.sign(
        {
            _id: this._id,
            uid: this.uid,
            username: this.username,
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