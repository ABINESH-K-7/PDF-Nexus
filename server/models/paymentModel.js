import mongoose from "mongoose"

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: "INR" },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created", index: true },
  plan: { type: String, enum: ["go", "pro", "premium"], required: true },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true })

export default mongoose.model("Payment", paymentSchema)
