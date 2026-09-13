// models/Chat.js
import mongoose from "mongoose"

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "ai"], required: true },
  text: String,
  createdAt: { type: Date, default: Date.now }
})

const ChatThreadSchema = new mongoose.Schema({
  threadId: { type: String, required: true },
  title: { type: String, default: "New Chat" },
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  fileId: { type: String, index: true }, // PDF id / node id
  threads: [ChatThreadSchema],
  activeThreadId: String,
}, { timestamps: true })

ChatSchema.index({ userId: 1, fileId: 1 }, { unique: true })

export default mongoose.model("Chat", ChatSchema)
