import passport from "passport";
import  {Strategy as GoogleStrategy} from "passport-google-oauth20"
import { User } from "../models/userModel.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.SERVER_URL || "http://localhost:3000"}/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const email = profile.emails[0].value || null;

        let user = await User.findOne({ email });

        if (user) {
          // Link Google to existing account
          user.googleId = profile.id;
          user.avatar = profile.photos[0].value || null;
          user.isLoggedIn = true;
          user.isVerified = true;
          user.provider = "google";
          await user.save();
        } else {
          // Create new Google user
          user = await User.create({
            googleId: profile.id,
            username: profile.displayName,
            email,
            avatar: profile.photos[0].value,
            isLoggedIn: true,
            isVerified: true,
            provider: "google"
          });
        }

        return cb(null, user);
      } catch (error) {
        return cb(error, null);
      }
    }
  )
);
