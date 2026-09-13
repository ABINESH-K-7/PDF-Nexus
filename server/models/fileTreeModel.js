import mongoose from "mongoose";

const fileTreeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    tree: {
      type: Array, // 👈 your tree JSON
      default: []
    }
  },
  { timestamps: true }
);

export const FileTree = mongoose.model("FileTree", fileTreeSchema);
