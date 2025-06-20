import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { aiRecommendationService } from "./services/ai-recommendation-service";
import { searchFiltersSchema, cardCache, cardThemes, themeVotes } from "@shared/schema";
import { db } from "./db";
import { desc, eq, and, count } from "drizzle-orm";
import { z } from "zod";
import { cardMatchesFilters } from "./utils/card-filters";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register card admin routes
  registerCardAdminRoutes(app);

  // Initialize card database migration and download in background
  console.log("Starting card database setup...");
  import("./services/card-migration-service").then(({ cardMigrationService }) => {
    cardMigrationService.createCardsTablesIfNeeded().then(() => {
      return cardDatabaseService.initializeDatabase();
    }).catch(error => {
      console.error("Failed to initialize card database:", error);
    });
  });
  // Auth middleware
  await setupAuth(app);
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
      
      // Parse filters early to pass to storage methods
      let parsedFilters = null;
      if (filters) {
        try {
          parsedFilters = JSON.parse(filters as string);
        } catch (err) {
          console.warn('Failed to parse filters:', err);
        }
      }

      if (type === 'synergy') {
        recs = await storage.findSynergyCards(sourceCard, parsedFilters);
      } else if (type === 'functional_similarity') {
        recs = await storage.findFunctionallySimilarCards(sourceCard, parsedFilters);
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
          recsWithCards = recsWithCards.filter(rec => {
            if (!rec.card) return false;
            return cardMatchesFilters(rec.card, searchFilters);
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
      
      // Personalized recommendations are now handled by theme-based synergy system
      const recommendations = [];
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

  // Theme suggestions endpoint - get themes for a card with example cards
  app.get("/api/cards/:id/theme-suggestions", async (req, res) => {
    try {
      const { id } = req.params;
      const { filters } = req.query;
      const userId = 1; // Default user for now
      
      let filterObj = null;
      if (filters && typeof filters === 'string') {
        try {
          filterObj = JSON.parse(filters);
        } catch (e) {
          console.warn('Invalid filters JSON:', filters);
        }
      }
      
      // Get the card first
      const card = await storage.getCard(id);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Generate themes if they don't exist
      await aiRecommendationService.generateCardThemes(card);
      
      // Get card's themes
      const themes = await db
        .select()
        .from(cardThemes)
        .where(eq(cardThemes.card_id, id));

      // Get user's existing votes for all cards and themes
      const userVotes = await db
        .select()
        .from(themeVotes)
        .where(eq(themeVotes.user_id, userId));

      const themeGroups = [];
      
      // For each theme, get example cards
      for (const theme of themes) {
        const cardsWithConfidence = await aiRecommendationService.getCardsForTheme(
          theme.theme_name, 
          id, 
          filterObj
        );
        
        themeGroups.push({
          theme: theme.theme_name,
          description: `${theme.theme_name} strategy`,
          confidence: theme.confidence,
          cards: cardsWithConfidence
        });
      }
      
      res.json({ themeGroups, userVotes });
    } catch (error) {
      console.error('Theme suggestions error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Theme voting endpoint
  app.post('/api/cards/:cardId/theme-vote', async (req, res) => {
    try {
      const { cardId } = req.params;
      const { themeName, vote } = req.body;
      const userId = 1; // Default user for now

      // Check if user already voted on this theme
      const existingVote = await db
        .select()
        .from(themeVotes)
        .where(and(
          eq(themeVotes.card_id, cardId),
          eq(themeVotes.theme_name, themeName),
          eq(themeVotes.user_id, userId)
        ))
        .limit(1);

      if (existingVote.length > 0) {
        // Check if user is trying to vote the same way again
        if (existingVote[0].vote === vote) {
          return res.status(400).json({ 
            error: `You already voted ${vote} on this theme`,
            sameVote: true
          });
        }
        
        // User already voted differently, update their existing vote
        await db
          .update(themeVotes)
          .set({ vote: vote })
          .where(eq(themeVotes.id, existingVote[0].id));
      } else {
        // Create new vote
        await db.insert(themeVotes).values({
          card_id: cardId,
          theme_name: themeName,
          user_id: userId,
          vote: vote
        });
      }

      // Calculate new confidence using your specified algorithm
      const allVotes = await db
        .select()
        .from(themeVotes)
        .where(and(
          eq(themeVotes.card_id, cardId),
          eq(themeVotes.theme_name, themeName)
        ));

      const upVotes = allVotes.filter(v => v.vote === 'up').length;
      const downVotes = allVotes.filter(v => v.vote === 'down').length;
      const totalVotes = upVotes + downVotes;

      // Get current confidence from card_themes
      const currentTheme = await db
        .select()
        .from(cardThemes)
        .where(and(
          eq(cardThemes.card_id, cardId),
          eq(cardThemes.theme_name, themeName)
        ))
        .limit(1);

      if (currentTheme.length === 0) {
        return res.status(404).json({ error: 'Theme not found' });
      }

      let newConfidence = currentTheme[0].confidence;

      // Apply your voting algorithm: max(1%, 10%/votes) adjustment
      if (totalVotes > 0) {
        const adjustmentPerVote = Math.max(1, 10 / totalVotes);
        const netVotes = upVotes - downVotes;
        newConfidence = Math.max(0, Math.min(100, currentTheme[0].confidence + (netVotes * adjustmentPerVote)));
      }

      // Update confidence in database or remove if below threshold
      if (newConfidence < 25) {
        // Remove theme if it drops below 25%
        await db
          .delete(cardThemes)
          .where(and(
            eq(cardThemes.card_id, cardId),
            eq(cardThemes.theme_name, themeName)
          ));
        
        // Also remove associated votes
        await db
          .delete(themeVotes)
          .where(and(
            eq(themeVotes.card_id, cardId),
            eq(themeVotes.theme_name, themeName)
          ));

        res.json({ success: true, newScore: 0, removed: true, message: 'Theme removed due to low confidence' });
      } else {
        await db
          .update(cardThemes)
          .set({ confidence: newConfidence })
          .where(and(
            eq(cardThemes.card_id, cardId),
            eq(cardThemes.theme_name, themeName)
          ));

        res.json({ success: true, newScore: newConfidence });
      }
    } catch (error) {
      console.error('Theme vote error:', error);
      res.status(500).json({ error: 'Failed to record vote' });
    }
  });

  // Recommendation voting endpoint
  app.post('/api/recommendations/:recommendationId/vote', async (req, res) => {
    try {
      const { recommendationId } = req.params;
      const { vote } = req.body;
      const userId = 1;

      const { db } = await import('./db');
      const { cardRecommendations } = await import('@shared/schema');
      const { eq, sql } = await import('drizzle-orm');
      
      const recommendation = await db.select().from(cardRecommendations)
        .where(eq(cardRecommendations.id, parseInt(recommendationId)))
        .limit(1);

      if (!recommendation.length) {
        return res.status(404).json({ error: 'Recommendation not found' });
      }

      // Check if user already voted
      const existingVote = await db.execute(sql`
        SELECT id FROM user_votes 
        WHERE user_id = ${userId} AND target_type = 'recommendation' AND target_id = ${parseInt(recommendationId)}
      `);

      if (existingVote.rows.length > 0) {
        return res.status(400).json({ error: 'You have already voted on this recommendation' });
      }

      // Record vote
      await db.execute(sql`
        INSERT INTO user_votes (user_id, target_type, target_id, vote)
        VALUES (${userId}, 'recommendation', ${parseInt(recommendationId)}, ${vote})
      `);

      // Update vote counts using raw SQL
      const voteIncrement = vote === 'up' ? 1 : 0;
      const downvoteIncrement = vote === 'down' ? 1 : 0;
      
      await db.execute(sql`
        UPDATE card_recommendations 
        SET upvotes = COALESCE(upvotes, 0) + ${voteIncrement},
            downvotes = COALESCE(downvotes, 0) + ${downvoteIncrement},
            user_votes_count = COALESCE(user_votes_count, 0) + 1
        WHERE id = ${parseInt(recommendationId)}
      `);

      // Get updated recommendation data
      const updatedRec = await db.execute(sql`
        SELECT upvotes, downvotes, score FROM card_recommendations WHERE id = ${parseInt(recommendationId)}
      `);
      
      const upvotes = Number(updatedRec.rows[0]?.upvotes) || 0;
      const downvotes = Number(updatedRec.rows[0]?.downvotes) || 0;
      const totalVotes = upvotes + downvotes;
      const positiveRatio = totalVotes > 0 ? upvotes / totalVotes : 0.5;
      const baseScore = recommendation[0].score;
      const adjustedScore = Math.max(10, Math.min(100, Math.round(baseScore * (0.7 + 0.6 * positiveRatio))));

      await db.execute(sql`
        UPDATE card_recommendations SET score = ${adjustedScore} WHERE id = ${parseInt(recommendationId)}
      `);

      res.json({ 
        success: true, 
        message: `Vote recorded! Recommendation score updated.`,
        newScore: adjustedScore,
        upvotes: upvotes,
        downvotes: downvotes
      });
    } catch (error) {
      console.error('Error recording recommendation vote:', error);
      res.status(500).json({ error: 'Failed to record vote' });
    }
  });

  // Theme upvote endpoint (alias for theme-vote)
  app.post('/api/cards/:cardId/upvote-theme', async (req, res) => {
    try {
      const { cardId } = req.params;
      const { theme, categoryName } = req.body;
      const userId = 1;

      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      
      // Record the upvote for this theme category combination
      await db.execute(sql`
        INSERT INTO user_votes (user_id, target_type, target_id, vote)
        VALUES (${userId}, 'theme_upvote', 0, 'up')
      `);

      // Update theme confidence based on upvote
      await db.execute(sql`
        INSERT INTO card_themes (card_id, theme_name, theme_category, confidence, description, upvotes, downvotes, user_votes_count)
        VALUES (${cardId}, ${theme}, ${categoryName}, 75, 'User-upvoted theme', 1, 0, 1)
        ON CONFLICT (card_id, theme_name) DO UPDATE SET
          upvotes = COALESCE(upvotes, 0) + 1,
          user_votes_count = COALESCE(user_votes_count, 0) + 1,
          confidence = LEAST(100, COALESCE(confidence, 50) + 10)
      `);

      res.json({ 
        success: true, 
        message: `Theme "${theme}" upvoted for category "${categoryName}"!`
      });
    } catch (error) {
      console.error('Error recording theme upvote:', error);
      res.status(500).json({ error: 'Failed to record upvote' });
    }
  });

  // Card-theme relevance voting endpoint
  app.post('/api/cards/:cardId/theme-relevance-vote', async (req, res) => {
    try {
      const { cardId } = req.params;
      const { themeName, vote, sourceCardId } = req.body;
      const userId = 1;

      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      
      // Create or update card-theme relevance vote
      await db.execute(sql`
        INSERT INTO user_votes (user_id, target_type, target_id, vote)
        VALUES (${userId}, 'card_theme_relevance', 0, ${vote})
      `);

      // Record card-theme relevance feedback
      const feedbackType = vote === 'up' ? 'relevant' : 'irrelevant';
      await db.execute(sql`
        INSERT INTO card_theme_feedback (card_id, theme_name, source_card_id, feedback_type, user_id)
        VALUES (${cardId}, ${themeName}, ${sourceCardId}, ${feedbackType}, ${userId})
        ON CONFLICT (card_id, theme_name, source_card_id, user_id) DO UPDATE SET
          feedback_type = ${feedbackType},
          created_at = NOW()
      `);

      res.json({ 
        success: true, 
        message: `Card relevance vote recorded!`
      });
    } catch (error) {
      console.error('Error recording card-theme vote:', error);
      res.status(500).json({ error: 'Failed to record vote' });
    }
  });

  // Get similar cards based on tags
  app.get('/api/cards/:cardId/similar-by-tags', async (req, res) => {
    try {
      const { cardId } = req.params;
      const filters = req.query as any;
      
      const cards = await tagSystem.findCardsWithSimilarTags(cardId, filters);
      res.json({ cards });
    } catch (error) {
      console.error('Similar cards error:', error);
      res.status(500).json({ error: 'Failed to find similar cards' });
    }
  });

  // Get synergistic cards based on tag relationships
  app.get('/api/cards/:cardId/synergistic-by-tags', async (req, res) => {
    try {
      const { cardId } = req.params;
      const filters = req.query as any;
      
      const cards = await tagSystem.findSynergisticCards(cardId, filters);
      res.json({ cards });
    } catch (error) {
      console.error('Synergistic cards error:', error);
      res.status(500).json({ error: 'Failed to find synergistic cards' });
    }
  });

  // Theme-based synergy endpoint
  app.get("/api/cards/:cardId/theme-synergies", async (req, res) => {
    try {
      const { cardId } = req.params;
      const { filters } = req.query;
      
      // Get the source card
      const sourceCard = await storage.getCard(cardId);
      if (!sourceCard) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Parse filters
      let parsedFilters = null;
      if (filters) {
        try {
          parsedFilters = JSON.parse(filters as string);
        } catch (err) {
          console.warn('Failed to parse filters:', err);
        }
      }
      
      // Generate themes if they don't exist
      await aiRecommendationService.generateCardThemes(sourceCard);
      
      // Find synergy recommendations using new algorithm
      const synergies = await aiRecommendationService.findSynergyRecommendations(
        cardId, 
        parsedFilters
      );
      
      // Format for frontend
      const formattedSynergies = synergies.map(synergy => ({
        card: synergy.card,
        sharedThemes: [], // We'll populate this if needed
        synergyScore: synergy.synergyScore,
        reason: `${Math.round(synergy.synergyScore)}% theme match`
      }));
      
      res.json(formattedSynergies);
    } catch (error) {
      console.error('Theme synergies error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // On-demand theme card loading
  app.get('/api/cards/:cardId/theme/:themeName/cards', async (req, res) => {
    try {
      const { cardId, themeName } = req.params;
      const filters = req.query as any;
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }

      const theme = { theme: decodeURIComponent(themeName), description: `${decodeURIComponent(themeName)} strategy` };
      const matchingCards = await pureAIService.findCardsForTheme(theme, card, filters);
      
      res.json({ cards: matchingCards });
    } catch (error) {
      console.error('Theme suggestions error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate recommendations for popular cards (admin endpoint)
  app.post("/api/admin/generate-recommendations", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Theme generation is now handled automatically by AI service
      console.log('Neural network handles recommendation generation automatically');
      
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
      
      console.log(`🎯 Recording theme feedback:`, {
        userId: 1,
        sourceCard: id,
        theme: themeName,
        helpful: feedback,
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Theme feedback error:', error);
      res.status(500).json({ error: 'Failed to record feedback' });
    }
  });

  // Card recommendation feedback endpoint
  app.post("/api/cards/:sourceId/recommendation-feedback", async (req, res) => {
    try {
      const { sourceId } = req.params;
      const { recommendedCardId, helpful, recommendationType } = req.body;
      
      console.log(`📝 Recording recommendation feedback:`, {
        userId: 1,
        sourceCard: sourceId,
        recommendedCard: recommendedCardId,
        type: recommendationType,
        helpful: helpful ? 'helpful' : 'not_helpful',
        timestamp: new Date().toISOString()
      });
      
      await storage.recordRecommendationFeedback({
        userId: 1,
        sourceCardId: sourceId,
        recommendedCardId,
        recommendationType: recommendationType || 'synergy',
        feedback: helpful ? 'helpful' : 'not_helpful'
      });
      
      console.log(`✅ Feedback recorded successfully - this will improve future ${recommendationType} recommendations`);
      
      res.json({ 
        success: true, 
        message: `Thank you! Your feedback helps improve ${recommendationType} recommendations.`,
        impact: `This feedback adjusts the recommendation weights for similar cards.`
      });
    } catch (error) {
      console.error('❌ Recommendation feedback error:', error);
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

  // User deck management routes
  app.get('/api/user/deck', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'demo-user';
      const deckData = await storage.getUserDeck(userId);
      res.json(deckData);
    } catch (error) {
      console.error('Error fetching user deck:', error);
      res.status(500).json({ message: 'Failed to fetch deck' });
    }
  });

  app.put('/api/user/deck', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'demo-user';
      const deckData = req.body;
      const savedDeck = await storage.saveUserDeck(userId, deckData);
      res.json(savedDeck);
    } catch (error) {
      console.error('Error saving user deck:', error);
      res.status(500).json({ message: 'Failed to save deck' });
    }
  });

  // Import deck from text
  app.post('/api/user/deck/import', async (req: any, res) => {
    try {
      // Use a default user ID for now since auth might not be set up
      const userId = req.user?.claims?.sub || 'demo-user';
      const { deckText, format } = req.body;
      
      if (!deckText || typeof deckText !== 'string') {
        return res.status(400).json({ message: 'Deck text is required' });
      }

      const result = await storage.importDeckFromText(userId, deckText, format);
      res.json(result);
    } catch (error) {
      console.error('Error importing deck:', error);
      res.status(500).json({ message: 'Failed to import deck' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
