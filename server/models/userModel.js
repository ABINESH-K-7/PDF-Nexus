import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: { type: String},
    email: { type: String, required: true, unique: true },
    password: { type: String},
    googleId: { type: String},
    avatar: { type: String},
    isVerified: { type: Boolean, default: false },
    isLoggedIn: { type: Boolean, default: false },
    token: { type: String, default: null },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    subscription: {
        plan: { type: String, enum: ["free", "go", "pro", "premium"], default: "free" },
        status: { type: String, enum: ["active", "expired", "cancelled"], default: "active" },
        razorpayOrderId: { type: String, default: null },
        razorpayPaymentId: { type: String, default: null },
        startDate: { type: Date, default: null },
        expiryDate: { type: Date, default: null }
    }
}, { timestamps: true })

export const User = mongoose.model("User", userSchema)
