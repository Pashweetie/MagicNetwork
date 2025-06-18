import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { recommendationService } from "./services/recommendation";
import { searchFiltersSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Search cards endpoint
  app.get("/api/cards/search", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      
      // Parse query parameters into filters
      const filters = {
        query: req.query.q as string,
        colors: req.query.colors ? (req.query.colors as string).split(',') : undefined,
        types: req.query.types ? (req.query.types as string).split(',') : undefined,
        rarities: req.query.rarities ? (req.query.rarities as string).split(',') : undefined,
        format: req.query.format as string,
        minMv: req.query.minMv ? parseInt(req.query.minMv as string) : undefined,
        maxMv: req.query.maxMv ? parseInt(req.query.maxMv as string) : undefined,
        includeMulticolored: req.query.includeMulticolored === 'true',
        oracleText: req.query.oracleText as string,
        set: req.query.set as string,
        artist: req.query.artist as string,
        power: req.query.power as string,
        toughness: req.query.toughness as string,
        loyalty: req.query.loyalty as string,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        colorIdentity: req.query.colorIdentity ? (req.query.colorIdentity as string).split(',') : undefined,
        keywords: req.query.keywords ? (req.query.keywords as string).split(',') : undefined,
        produces: req.query.produces ? (req.query.produces as string).split(',') : undefined,
      };

      // Validate filters
      const validatedFilters = searchFiltersSchema.parse(filters);
      
      const result = await storage.searchCards(validatedFilters, page);
      res.json(result);
    } catch (error) {
      console.error('Search error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid search parameters", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Get single card endpoint
  app.get("/api/cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const card = await storage.getCard(id);
      
      if (!card) {
        res.status(404).json({ message: "Card not found" });
        return;
      }
      
      res.json(card);
    } catch (error) {
      console.error('Get card error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get random card endpoint
  app.get("/api/cards/random", async (req, res) => {
    try {
      const card = await storage.getRandomCard();
      res.json(card);
    } catch (error) {
      console.error('Random card error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Card recommendations endpoint
  app.get("/api/cards/:id/recommendations", async (req, res) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const recommendations = await recommendationService.getCardRecommendations(id, limit);
      res.json(recommendations);
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Personalized recommendations endpoint
  app.get("/api/users/:userId/recommendations", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 20;
      
      const recommendations = await recommendationService.getPersonalizedRecommendations(userId, limit);
      res.json(recommendations);
    } catch (error) {
      console.error('Personalized recommendations error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Track user interaction endpoint
  app.post("/api/interactions", async (req, res) => {
    try {
      const { userId, cardId, interactionType, metadata } = req.body;
      
      if (!userId || !cardId || !interactionType) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }
      
      await recommendationService.trackUserInteraction(userId, cardId, interactionType, metadata);
      res.json({ success: true });
    } catch (error) {
      console.error('Interaction tracking error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Theme suggestions endpoint (AI-powered)
  app.get("/api/cards/:id/theme-suggestions", async (req, res) => {
    try {
      const { id } = req.params;
      
      const themeGroups = await recommendationService.getThemeSuggestions(id);
      res.json(themeGroups);
    } catch (error) {
      console.error('Theme suggestions error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate recommendations for popular cards (admin endpoint)
  app.post("/api/admin/generate-recommendations", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Run in background
      recommendationService.generateRecommendationsForPopularCards(limit)
        .catch(error => console.error('Background recommendation generation failed:', error));
      
      res.json({ message: "Recommendation generation started" });
    } catch (error) {
      console.error('Recommendation generation error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
