import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  type Profile,
} from "passport-google-oauth20";
import { pool } from "./db";
import { storage } from "./storage";
import "dotenv/config";

const PgStore = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export function configureSession(app: Express) {
  app.set("trust proxy", 1);
  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: "session",
        createTableIfMissing: false,
      }),
      secret: process.env.SESSION_SECRET || "dev-insecure-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      },
    }),
  );
}

export function configureGoogleAuth(app: Express) {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || "http://localhost:5000";

  app.use(passport.initialize());

  if (!clientID || !clientSecret) {
    // Keys not provided yet — the /api/auth/google routes will return a
    // friendly 503 instead of crashing the server.
    console.warn(
      "[auth] GOOGLE_CLIENT_ID/SECRET not set — Google login is disabled until you add them to .env",
    );
    return false;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: `${appUrl}/api/auth/google/callback`,
        scope: ["profile", "email"],
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (err: any, user?: any) => void,
      ) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) {
            return done(new Error("Google account has no email"));
          }
          // Link by googleId, then by email, otherwise create.
          let user = await storage.getUserByGoogleId(profile.id);
          if (!user) {
            user = await storage.getUserByEmail(email);
          }
          if (!user) {
            user = await storage.createUser({
              email,
              name: profile.displayName || email.split("@")[0],
              authProvider: "google",
              googleId: profile.id,
              avatarUrl: profile.photos?.[0]?.value ?? null,
              emailVerified: true, // Google already verified this address
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
  return true;
}

/** Gate any route that requires a logged-in user. */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};
