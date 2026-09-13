import crypto from "crypto"
import Payment from "../models/paymentModel.js"
import { getRazorpayClient } from "../services/razorpayService.js"
import { SUBSCRIPTION_PLANS, isPaidPlan } from "../config/subscriptionPlans.js"

const subscriptionFor = (user) => ({
  plan: user.subscription?.plan || "free",
  status: user.subscription?.status || "active",
  startDate: user.subscription?.startDate || null,
  expiryDate: user.subscription?.expiryDate || null
})

export const createOrder = async (req, res) => {
  const { plan } = req.body || {}
  if (!isPaidPlan(plan)) return res.status(400).json({ success: false, message: "Choose a valid subscription plan." })
  const selectedPlan = SUBSCRIPTION_PLANS[plan]
  const razorpay = getRazorpayClient()
  if (!razorpay) return res.status(503).json({ success: false, message: "Payments are not configured yet." })
  try {
    const order = await razorpay.orders.create({
      amount: selectedPlan.amount,
      currency: selectedPlan.currency,
      receipt: `pn_${req.userId.toString().slice(-12)}_${Date.now().toString().slice(-12)}`,
      notes: { plan: selectedPlan.id, userId: req.userId.toString() }
    })
    await Payment.create({ userId: req.userId, razorpayOrderId: order.id, amount: order.amount, currency: order.currency, plan: selectedPlan.id })
    return res.status(201).json({ success: true, order: { id: order.id, amount: order.amount, currency: order.currency }, keyId: process.env.RAZORPAY_KEY_ID, plan: selectedPlan.id })
  } catch (error) {
    console.error("Razorpay order creation failed", error.message)
    return res.status(502).json({ success: false, message: "Unable to create a payment order. Please try again." })
  }
}

export const verifyPayment = async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {}
  if (![orderId, paymentId, signature].every((value) => typeof value === "string" && value.trim())) return res.status(400).json({ success: false, message: "Incomplete payment verification data." })
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${orderId}|${paymentId}`).digest("hex")
  const expectedBuffer = Buffer.from(expected, "utf8")
  const signatureBuffer = Buffer.from(signature, "utf8")
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return res.status(400).json({ success: false, message: "Payment verification failed." })
  try {
    const payment = await Payment.findOne({ userId: req.userId, razorpayOrderId: orderId })
    if (!payment) return res.status(404).json({ success: false, message: "Payment order not found." })
    if (payment.status === "paid") return res.json({ success: true, subscription: subscriptionFor(req.user), alreadyVerified: true })
    const claimed = await Payment.findOneAndUpdate({ _id: payment._id, status: "created" }, { $set: { status: "paid", razorpayPaymentId: paymentId, verifiedAt: new Date() } }, { new: true })
    if (!claimed) return res.status(409).json({ success: false, message: "Payment is already being processed." })
    const startDate = new Date()
    const expiryDate = new Date(startDate)
    expiryDate.setMonth(expiryDate.getMonth() + 1)
    req.user.subscription = { plan: payment.plan, status: "active", razorpayOrderId: orderId, razorpayPaymentId: paymentId, startDate, expiryDate }
    await req.user.save()
    return res.json({ success: true, subscription: subscriptionFor(req.user) })
  } catch (error) {
    console.error("Razorpay verification failed", error.message)
    return res.status(500).json({ success: false, message: "Unable to confirm payment." })
  }
}

export const getPaymentStatus = async (req, res) => {
  try {
    const subscription = subscriptionFor(req.user)
    if (isPaidPlan(subscription.plan) && subscription.expiryDate && subscription.expiryDate < new Date()) {
      req.user.subscription.plan = "free"
      req.user.subscription.status = "expired"
      await req.user.save()
      return res.json({ success: true, subscription: subscriptionFor(req.user) })
    }
    return res.json({ success: true, subscription })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load subscription status." })
  }
}
