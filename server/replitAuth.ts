import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || 'default-session-secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Allow HTTP for development
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    // Check for client-provided user ID in headers (from localStorage)
    let userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      // Check session as fallback
      userId = (req.session as any)?.autoUserId;
      
      if (!userId) {
        // Generate a unique anonymous user ID
        userId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        (req.session as any).autoUserId = userId;
      }
    }
    
    // Ensure user exists in database
    let dbUser = await storage.getUser(userId);
    if (!dbUser) {
      await storage.createUser({
        id: userId,
        username: userId,
        email: `${userId}@anonymous.local`
      });
      console.log(`🔑 Created new user: ${userId}`);
    }

    // Attach user to request
    (req as any).user = { claims: { sub: userId } };
    return next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

