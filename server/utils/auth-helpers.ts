import type { Request, Response } from "express";

/**
 * Extract user ID from authenticated request
 */
export function extractUserId(req: Request): string | null {
  return (req as any).user?.claims?.sub || null;
}

/**
 * Extract and validate user ID, sending 401 response if not found
 * Returns null if user is not authenticated (response already sent)
 * Returns userId string if authenticated
 */
export function requireUserId(req: Request, res: Response): string | null {
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return null;
  }
  return userId;
}