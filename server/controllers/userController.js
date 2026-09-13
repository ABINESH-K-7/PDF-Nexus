import { sendOtpMail } from "../emailVerify/sendOtpMail.js";
import { verifyMail } from "../emailVerify/verifyMail.js";
import { Session } from "../models/sessionModel.js";
import { User } from "../models/userModel.js";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"


export const setPassword = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      })
    }

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      })
    }
    if (user.password) {
  return res.status(400).json({
    success: false,
    message: "Password already exists. Please login."
  })
}


    // 🔐 hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    user.password = hashedPassword
    await user.save()

    res.json({
      success: true,
      message: "Password created successfully"
    })

  } catch (err) {
    console.error("SET PASSWORD ERROR:", err)
    res.status(500).json({
      success: false,
      message: "Server error"
    })
  }
}

export const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            })
        }
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,
            isVerified: false
        })
        const token = jwt.sign({ id: newUser._id }, process.env.SECRET_KEY, { expiresIn: "10m" })
        verifyMail(token, email)
        newUser.token = token
        await newUser.save()
        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: newUser
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })

    }
}

export const verification = async (req, res) => {
    try {
      const { token } = req.params;

if (!token) {
  return res.status(400).json({
    success: false,
    message: "Verification token is missing"
  })
}


        let decoded;
        try {
            decoded = jwt.verify(token, process.env.SECRET_KEY)
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(400).json({
                    success: false,
                    message: "The registration token has expired"
                })
            }
            return res.status(400).json({
                success: false,
                message: "Token verification failed"
            })
        }
        const user = await User.findById(decoded.id)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
 
         // 🧪 DEBUG (REMOVE AFTER TESTING)
        console.log("Email verification token accepted for user", user._id.toString())


        user.isVerified = true
        user.token = null
        await user.save()

       return res.redirect(
  `${process.env.CLIENT_URL}/verify/${token}`
 )
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            })
        }
        console.log("LOGIN BODY:", req.body)
        

        const user = await User.findOne({ email })
        console.log("USER:", user)
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access"
            })
        }

  // 🔥 CRITICAL FIX (Google / no-password users)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This account uses Google login. Please sign in with Google."
      })
    }

        const passwordCheck = await bcrypt.compare(password, user.password)
        if (!passwordCheck) {
            return res.status(401).json({
                success: false,
                message: "Incorrect Password"
            })
        }

        //check if user is verified 
        if (!user.isVerified ) {
            return res.status(403).json({
                success: false,
                message: "Verify your account than login"
            })
        }

        // check for existing session and delete it
        const existingSession = await Session.findOne({ userId: user._id });
        if (existingSession) {
            await Session.deleteOne({ userId: user._id })
        }

        //create a new session
        await Session.create({ userId: user._id })

        //Generate tokens
        const accessToken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: "10d" })
        const refreshToken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: "30d" })

        user.isLoggedIn = true;
        await user.save()

        return res.status(200).json({
            success: true,
            message: `Welcome back ${user.username}`,
            accessToken,
            refreshToken,
            user
        })
    } catch (error) {
         console.error("LOGIN ERROR:", error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const logoutUser = async (req, res) => {
    try {

        //  console.log("LOGOUT HIT", req.userId);

        const userId = req.userId;
        await Session.deleteMany({ userId });
        await User.findByIdAndUpdate(userId, { isLoggedIn: false })
      
        // console.log("SESSIONS CLEARED");


      if (req.logout) {
            req.logout(() => console.log("PASSPORT LOGOUT OK"));
        } else {
            console.log("req.logout NOT FOUND");
        }
        // clear cookie-session
        req.session = null;

        console.log("SESSION CLEARED");
      
      
        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        })
    } catch (error) {
        console.error("LOGOUT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 10 * 60 * 1000

        user.otp = otp;
        user.otpExpiry = expiry;
        await user.save()
        await sendOtpMail(email, otp);
        return res.status(200).json({
            success:true,
            message:"OTP sent successfully"
            
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const verifyOTP = async (req, res)=>{
    const {email,otp} = req.body
  console.log("VERIFY OTP HIT")
  console.log("PARAM EMAIL:", req.params.email)
  console.log("BODY OTP:", req.body.otp)

    if(!email || !otp){
        return res.status(400).json({
            success:false,
            message:"Email and OTP is requried"
        })
    }

    try {
        const user = await User.findOne({email})
        if(!user){
            return res.status(404).json({
                success:false,
                message:"User not found"
            })
        }
        if(!user.otp || !user.otpExpiry){
            return res.status(400).json({
                success:false,
                message:"OTP not generated or already verified"
            })
        }
        if (user.otpExpiry <  Date.now()){
            return res.status(400).json({
                success:false,
                message:"OTP has expired. Please request a new one"
            })
        }


        if (String(user.otp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      })
    }

   // ✅ CREATE RESET TOKEN
  const resetToken = jwt.sign(
    { email: user.email },
    process.env.SECRET_KEY,
    { expiresIn: "10m" }
  )

        user.otp = null
        user.otpExpiry = null
        await user.save()

        return res.status(200).json({
            success:true,
            message:"OTP verified successfully",
            resetToken
        })
    } catch (error) {
        return res.status(500).json({
            success:false,
            message:"Internal server error"
        })
    }
}

export const changePassword = async (req, res)=>{
    const { token,newPassword, confirmPassword} = req.body
    
    if(!token ||  !newPassword || !confirmPassword){
        return res.status(400).json({
            success:false,
            message:"All fields are required"
        })
    }

    if(newPassword !== confirmPassword) {
        return res.status(400).json({
            success:false,
            message:"Password do not match"
        })
    }

  let decoded
  try {
    decoded = jwt.verify(token, process.env.SECRET_KEY)
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset token"
    })
  }

    try {
        const user = await User.findOne({ email: decoded.email })
        if(!user){
            return res.status(404).json({
                success:false,
                message:"User not found"
            })
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.password = hashedPassword

              
        await user.save()

        return res.status(200).json({
            success:true,
            message:"Password changed successsfully"
        })
    } catch (error) {
        return res.status(500).json({
            success:false,
            message:"Internal server error"
        })
    }
}
