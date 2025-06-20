import { Express, Request, Response } from "express";
import { cardDatabaseService } from "../services/card-database-service";

export function registerCardAdminRoutes(app: Express) {
  // Initialize card database
  app.post("/api/admin/cards/initialize", async (_req: Request, res: Response) => {
    try {
      await cardDatabaseService.initializeDatabase();
      res.json({ success: true, message: "Card database initialization started" });
    } catch (error) {
      console.error("Database initialization error:", error);
      res.status(500).json({ error: "Failed to initialize database" });
    }
  });

  // Get download progress
  app.get("/api/admin/cards/download-progress", (_req: Request, res: Response) => {
    const progress = cardDatabaseService.getDownloadProgress();
    res.json(progress);
  });

  // Get card count
  app.get("/api/admin/cards/count", async (_req: Request, res: Response) => {
    try {
      const count = await cardDatabaseService.getCardCount();
      res.json({ count });
    } catch (error) {
      console.error("Get card count error:", error);
      res.status(500).json({ error: "Failed to get card count" });
    }
  });

  // Force download all cards
  app.post("/api/admin/cards/download", async (_req: Request, res: Response) => {
    try {
      await cardDatabaseService.downloadAllCards();
      res.json({ success: true, message: "Card download completed" });
    } catch (error) {
      console.error("Card download error:", error);
      res.status(500).json({ error: "Failed to download cards" });
    }
  });

  // Check for updates manually
  app.post("/api/admin/cards/check-updates", async (_req: Request, res: Response) => {
    try {
      await cardDatabaseService.checkForUpdates();
      res.json({ success: true, message: "Update check completed" });
    } catch (error) {
      console.error("Update check error:", error);
      res.status(500).json({ error: "Failed to check for updates" });
    }
  });

  // Get last update time
  app.get("/api/admin/cards/last-update", async (_req: Request, res: Response) => {
    try {
      const lastUpdate = await cardDatabaseService.getLastUpdateTime();
      const daysSinceUpdate = lastUpdate ? 
        (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24) : null;
      
      res.json({ 
        lastUpdate: lastUpdate?.toISOString() || null,
        daysSinceUpdate: daysSinceUpdate ? Math.round(daysSinceUpdate * 10) / 10 : null
      });
    } catch (error) {
      console.error("Get last update error:", error);
      res.status(500).json({ error: "Failed to get last update time" });
    }
  });
}