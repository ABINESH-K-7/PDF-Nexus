import express from "express"
import { changePassword, forgotPassword, loginUser, logoutUser, registerUser, setPassword, verification, verifyOTP } from "../controllers/userController.js"
import { isAuthenticated } from "../middleware/isAuthenticated.js"
import { userSchema, validateUser } from "../validators/userValidate.js"

const router = express.Router()


router.post('/register',validateUser(userSchema), registerUser)
router.get('/verify/:token', verification)
router.post('/login', loginUser)
router.post('/logout',isAuthenticated, logoutUser)
router.post('/forgot-password', forgotPassword)
router.post('/verify-otp', verifyOTP)
router.post('/change-password', changePassword)
router.post("/set-password", setPassword)

// router.post('/price',isAuthenticated, price)


export default router