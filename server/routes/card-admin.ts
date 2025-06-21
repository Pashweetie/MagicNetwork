import { Express, Request, Response } from "express";
import { cardDatabaseService } from "../services/card-database-service";
import { db } from "../db";
import { cards, cardRulings } from "@shared/schema";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../replitAuth";

export function registerCardAdminRoutes(app: Express) {
  // Initialize card database
  app.post("/api/admin/cards/initialize", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      await cardDatabaseService.initializeDatabase();
      res.json({ success: true, message: "Card database initialization started" });
    } catch (error) {
      console.error("Database initialization error:", error);
      res.status(500).json({ error: "Failed to initialize database" });
    }
  });

  // Get download progress
  app.get("/api/admin/cards/download-progress", isAuthenticated, (_req: Request, res: Response) => {
    const progress = cardDatabaseService.getDownloadProgress();
    res.json(progress);
  });

  // Get card count
  app.get("/api/admin/cards/count", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const count = await cardDatabaseService.getCardCount();
      res.json({ count });
    } catch (error) {
      console.error("Get card count error:", error);
      res.status(500).json({ error: "Failed to get card count" });
    }
  });

  // Force download all cards
  app.post("/api/admin/cards/download", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      await cardDatabaseService.downloadAllCards();
      res.json({ success: true, message: "Card download completed" });
    } catch (error) {
      console.error("Card download error:", error);
      res.status(500).json({ error: "Failed to download cards" });
    }
  });

  // Check for updates manually
  app.post("/api/admin/cards/check-updates", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      await cardDatabaseService.checkForUpdates();
      res.json({ success: true, message: "Update check completed" });
    } catch (error) {
      console.error("Update check error:", error);
      res.status(500).json({ error: "Failed to check for updates" });
    }
  });

  // Get last update time
  app.get("/api/admin/cards/last-update", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const lastUpdate = await cardDatabaseService.getLastUpdateTime();
      const daysSinceUpdate = lastUpdate ? 
        (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24) : null;
      
      res.json({ 
        lastUpdate: lastUpdate?.toISOString() || null,
        daysSinceUpdate: daysSinceUpdate ? Math.round(daysSinceUpdate * 10) / 10 : null
      });
    } catch (error) {
      console.error("Get last update error:", error);
      res.status(500).json({ error: "Failed to get last update time" });
    }
  });

  // New enhanced database management endpoints
  app.get("/api/admin/database/stats", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const [cardCount, rulingsCount, lastUpdate] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(cards),
        db.select({ count: sql<number>`count(*)` }).from(cardRulings),
        cardDatabaseService.getLastUpdateTime()
      ]);

      const [missingOracleText, missingKeywords] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(cards).where(sql`oracle_text IS NULL OR oracle_text = ''`),
        db.select({ count: sql<number>`count(*)` }).from(cards).where(sql`array_length(keywords, 1) IS NULL OR array_length(keywords, 1) = 0`)
      ]);

      res.json({
        cards: cardCount[0]?.count || 0,
        rulings: rulingsCount[0]?.count || 0,
        lastUpdate,
        missingData: {
          cardsWithoutOracleText: missingOracleText[0]?.count || 0,
          cardsWithoutKeywords: missingKeywords[0]?.count || 0,
          cardsWithoutRulings: Math.max(0, (cardCount[0]?.count || 0) - (rulingsCount[0]?.count || 0))
        }
      });
    } catch (error) {
      console.error("Error getting database stats:", error);
      res.status(500).json({ error: "Failed to get database statistics" });
    }
  });

  app.get("/api/admin/database/bulk-data-info", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const response = await fetch("https://api.scryfall.com/bulk-data");
      const data = await response.json();
      
      const bulkDataInfo = data.data.map((item: any) => ({
        type: item.type,
        name: item.name,
        description: item.description,
        size: item.compressed_size || 0,
        lastUpdated: item.updated_at
      }));

      res.json(bulkDataInfo);
    } catch (error) {
      console.error("Error getting bulk data info:", error);
      res.status(500).json({ error: "Failed to get bulk data information" });
    }
  });

  app.post("/api/admin/database/download-enhanced-cards", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      // Trigger download of missing data
      cardDatabaseService.downloadMissingData();
      res.json({ success: true, message: "Enhanced card data download started" });
    } catch (error) {
      console.error("Error starting enhanced download:", error);
      res.status(500).json({ error: "Failed to start enhanced download" });
    }
  });

  app.post("/api/admin/database/download-rulings", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      // Trigger rulings download
      cardDatabaseService.checkAndDownloadRulings();
      res.json({ success: true, message: "Rulings download started" });
    } catch (error) {
      console.error("Error starting rulings download:", error);
      res.status(500).json({ error: "Failed to start rulings download" });
    }
  });
}