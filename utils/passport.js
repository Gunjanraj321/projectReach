require("dotenv").config();
const passport = require("passport");
const { User } = require("../models/googleModel");
const GoogleStrategy = require("passport-google-oauth20").Strategy;


passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      console.log("Google Profile:", profile);
      profile.tokens = { accessToken, refreshToken };
      try {
        const user = User.create({
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails.value,
          refreshToken: refreshToken,
          accessToken: accessToken,
        });
        console.log(user);
      } catch (err) {
        throw err;
      }
      return done(null, profile);
    }
  )
);

module.exports = passport;
