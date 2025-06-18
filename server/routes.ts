import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { recommendationService } from "./services/recommendation";
import { searchFiltersSchema, cardCache } from "@shared/schema";
import { db } from "./db";
import { desc } from "drizzle-orm";
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

  // Card recommendations endpoint - using new algorithms directly
  app.get("/api/cards/:id/recommendations", async (req, res) => {
    try {
      const { id } = req.params;
      const { type = 'synergy', limit = 10, filters } = req.query;
      
      // Get the source card
      const sourceCard = await storage.getCard(id);
      if (!sourceCard) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Generate recommendations on the fly using the new algorithms
      let recs: Array<{cardId: string, score: number, reason: string}> = [];
      
      if (type === 'synergy') {
        recs = await storage.findSynergyCards(sourceCard);
      } else if (type === 'functional_similarity') {
        recs = await storage.findFunctionallySimilarCards(sourceCard);
      }
      
      // Convert to the expected format with card data
      let recsWithCards = await Promise.all(
        recs.slice(0, parseInt(limit as string) * 2).map(async (rec) => { // Get more to filter from
          const card = await storage.getCard(rec.cardId);
          return {
            card,
            score: rec.score,
            reason: rec.reason,
            sourceCardId: id,
            recommendedCardId: rec.cardId,
            recommendationType: type
          };
        })
      );
      
      // Filter by current search filters if provided
      if (filters) {
        try {
          const searchFilters = JSON.parse(filters as string);
              const originalLength = recsWithCards.length;
          recsWithCards = recsWithCards.filter(rec => {
            if (!rec.card) return false;
            const card = rec.card;
            
            // Filter by colors (including color identity)
            if (searchFilters.colors && searchFilters.colors.length > 0) {
              const cardColors = card.colors || [];
              const cardColorIdentity = card.color_identity || [];
              
              if (searchFilters.includeMulticolored) {
                // Card must contain all specified colors
                if (!searchFilters.colors.every((color: string) => cardColors.includes(color))) {
                  return false;
                }
              } else {
                // Card must contain at least one specified color
                if (!searchFilters.colors.some((color: string) => cardColors.includes(color))) {
                  return false;
                }
              }
            }
            
            // Filter by color identity (commander constraint)
            if (searchFilters.colorIdentity && searchFilters.colorIdentity.length > 0) {
              const cardIdentity = card.color_identity || [];
              // Card's color identity must be subset of allowed colors (commander colors)
              if (!cardIdentity.every((color: string) => searchFilters.colorIdentity.includes(color))) {
                return false;
              }
            }
            
            // Filter by types
            if (searchFilters.types && searchFilters.types.length > 0) {
              const cardTypes = card.type_line.toLowerCase();
              if (!searchFilters.types.some((type: string) => cardTypes.includes(type.toLowerCase()))) {
                return false;
              }
            }
            
            // Filter by mana value range
            if (searchFilters.minMv !== undefined && card.cmc < searchFilters.minMv) {
              return false;
            }
            if (searchFilters.maxMv !== undefined && card.cmc > searchFilters.maxMv) {
              return false;
            }
            
            // Filter by format legality
            if (searchFilters.format && searchFilters.format !== 'all') {
              const legalities = card.legalities || {};
              if (legalities[searchFilters.format] !== 'legal') {
                return false;
              }
            }
            
            return true;
          });
          
        } catch (err) {
          console.warn('Failed to parse filters:', err);
        }
      }
      
      res.json(recsWithCards.filter(r => r.card).slice(0, parseInt(limit as string)));
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
      const { cardId, interactionType, metadata } = req.body;
      const userId = 1; // Default user for now
      
      await storage.recordUserInteraction({
        userId,
        cardId,
        interactionType,
        metadata
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Interaction tracking error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Context-aware suggestions endpoint
  app.get("/api/suggestions/contextual", async (req, res) => {
    try {
      const { limit = 20 } = req.query;
      
      // Return popular cards based on search frequency
      const popularCards = await db.select()
        .from(cardCache)
        .orderBy(desc(cardCache.searchCount))
        .limit(parseInt(limit as string));
      
      const suggestions = popularCards.map((c: any) => c.cardData);
      res.json(suggestions);
    } catch (error) {
      console.error('Contextual suggestions error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Theme suggestions endpoint (AI-powered)
  app.get("/api/cards/:id/theme-suggestions", async (req, res) => {
    try {
      const { id } = req.params;
      const { filters } = req.query;
      
      let filterObj = null;
      if (filters && typeof filters === 'string') {
        try {
          filterObj = JSON.parse(filters);
        } catch (e) {
          console.warn('Invalid filters JSON:', filters);
        }
      }
      
      const themeGroups = await recommendationService.getThemeSuggestions(id, filterObj);
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

  // Theme feedback endpoint
  app.post("/api/cards/:id/theme-feedback", async (req, res) => {
    try {
      const { id } = req.params;
      const { themeName, feedback, reason } = req.body;
      
      // For now, assume userId = 1 (would come from auth in real app)
      const userId = 1;
      
      await storage.recordRecommendationFeedback({
        userId,
        sourceCardId: id,
        recommendedCardId: id, // For theme feedback, source and recommended are the same
        recommendationType: 'theme',
        feedback,
        userComment: reason
      });
      
      res.json({ message: "Feedback recorded" });
    } catch (error) {
      console.error('Theme feedback error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Card recommendation feedback endpoint
  app.post("/api/cards/:sourceId/recommendation-feedback", async (req, res) => {
    try {
      const { sourceId } = req.params;
      const { recommendedCardId, feedback, reason, type } = req.body;
      
      const userId = 1; // Would come from auth
      
      await storage.recordRecommendationFeedback({
        userId,
        sourceCardId: sourceId,
        recommendedCardId,
        recommendationType: type || 'synergy',
        feedback,
        userComment: reason
      });
      
      res.json({ message: "Feedback recorded" });
    } catch (error) {
      console.error('Recommendation feedback error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Deck persistence endpoints
  app.get("/api/decks", async (req, res) => {
    try {
      const userId = 1; // Would come from auth
      const decks = await storage.getUserDecks(userId);
      res.json(decks);
    } catch (error) {
      console.error('Get decks error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/decks", async (req, res) => {
    try {
      const userId = 1; // Would come from auth
      const deck = await storage.createDeck({
        ...req.body,
        userId
      });
      res.json(deck);
    } catch (error) {
      console.error('Create deck error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/decks/:id", async (req, res) => {
    try {
      const userId = 1; // Would come from auth
      const deck = await storage.getDeck(parseInt(req.params.id), userId);
      if (!deck) {
        return res.status(404).json({ message: "Deck not found" });
      }
      res.json(deck);
    } catch (error) {
      console.error('Get deck error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/decks/:id", async (req, res) => {
    try {
      const userId = 1; // Would come from auth
      const deck = await storage.updateDeck(parseInt(req.params.id), userId, req.body);
      if (!deck) {
        return res.status(404).json({ message: "Deck not found" });
      }
      res.json(deck);
    } catch (error) {
      console.error('Update deck error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/decks/:id", async (req, res) => {
    try {
      const userId = 1; // Would come from auth
      const success = await storage.deleteDeck(parseInt(req.params.id), userId);
      if (!success) {
        return res.status(404).json({ message: "Deck not found" });
      }
      res.json({ message: "Deck deleted" });
    } catch (error) {
      console.error('Delete deck error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
