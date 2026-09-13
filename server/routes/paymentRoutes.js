import express from "express"
import { createOrder, getPaymentStatus, verifyPayment } from "../controllers/paymentController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"

const router = express.Router()
router.use(isAuthenticated)
router.post("/create-order", createOrder)
router.post("/verify", verifyPayment)
router.get("/status", getPaymentStatus)
export default router
