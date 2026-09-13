import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";

export const isAuthenticated = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is missing or invalid"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: err.name === "TokenExpiredError"
        ? "Access token expired"
        : "Invalid token"
    });
  }
};
