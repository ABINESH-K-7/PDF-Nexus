import express from "express"
import 'dotenv/config'
import connectDB from "./database/db.js"
import userRoute from "./routes/userRoute.js"
import authRoute from "./routes/authRoute.js"
import cors from 'cors'
import "./config/passport.js"
import chatRoute from "./routes/chatRoutes.js";
import passport from "passport"
import fileRoute from "./routes/fileRoute.js";
import paymentRoute from "./routes/paymentRoutes.js";


// dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials:true
}));
app.use(express.json());
app.use(passport.initialize());
app.use('/auth', authRoute);
app.use('/user', userRoute);

app.use("/files", fileRoute);

// app.use("/uploads", express.static("uploads"));

app.use("/chat", chatRoute);
app.use("/payment", paymentRoute);


app.get("/", (req, res) => {
  res.send("Server Is Running ");
});

app.get("/health", (req, res) => {
  res.json({ success: true, service: "pdf-nexus-server" });
});

const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
    });

  } catch (error) {

    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);

  }
};

startServer();
