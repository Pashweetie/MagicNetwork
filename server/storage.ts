import { db } from "./db";
import { cardCache, searchCache, users, cardRecommendations, userInteractions, recommendationFeedback, cardThemes, themeRelationships, userThemeFeedback, decks, userDecks } from "@shared/schema";
import { Card, SearchFilters, SearchResponse, User, InsertUser, CardRecommendation, InsertCardRecommendation, UserInteraction, InsertUserInteraction, InsertRecommendationFeedback, Deck, InsertDeck, UserDeck, InsertUserDeck, DeckEntry, CardTheme, InsertCardTheme, ThemeRelationship, InsertThemeRelationship, UserThemeFeedback, InsertUserThemeFeedback } from "@shared/schema";
import { eq, sql, and, desc, asc, inArray, or } from "drizzle-orm";
import crypto from "crypto";
import { scryfallService } from "./services/scryfall";
import { cardMatchesFilters } from "./utils/card-filters";

export interface IStorage {
  // Card search methods
  searchCards(filters: SearchFilters, page: number): Promise<SearchResponse>;
  getCard(id: string): Promise<Card | null>;
  getRandomCard(): Promise<Card>;
  
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Cache management
  cacheCard(card: Card): Promise<void>;
  getCachedCard(id: string): Promise<Card | null>;
  cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void>;
  getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null>;
  cleanupOldCache(): Promise<void>;
  
  // User interactions for recommendations
  recordUserInteraction(interaction: InsertUserInteraction): Promise<void>;
  getUserInteractions(userId: number, limit?: number): Promise<UserInteraction[]>;
  
  // Recommendation system (simplified)
  getCardRecommendations(cardId: string, type: 'synergy' | 'functional_similarity', limit?: number, filters?: any): Promise<CardRecommendation[]>;
  
  // Theme-based synergy system
  findCardsBySharedThemes(sourceCard: Card, sourceThemes: Array<{theme: string, description: string, confidence: number, cards: Card[]}>, filters?: any): Promise<Array<{card: Card, sharedThemes: Array<{theme: string, confidence: number}>, synergyScore: number, reason: string}>>;
  
  // Enhanced theme system
  getCardThemes(cardId: string): Promise<CardTheme[]>;
  createCardTheme(theme: InsertCardTheme): Promise<CardTheme>;
  updateCardThemeVotes(cardId: string, themeName: string, upvotes: number, downvotes: number): Promise<void>;
  findCardsByThemes(themes: string[], filters?: any): Promise<Card[]>;
  getThemeRelationships(theme: string): Promise<ThemeRelationship[]>;
  createThemeRelationship(relationship: InsertThemeRelationship): Promise<ThemeRelationship>;
  recordUserThemeFeedback(feedback: InsertUserThemeFeedback): Promise<void>;
  calculateThemeSynergyScore(sourceThemes: string[], targetThemes: string[]): Promise<{score: number, reason: string}>;
  
  // Feedback system
  recordRecommendationFeedback(feedback: InsertRecommendationFeedback): Promise<void>;
  getRecommendationWeights(): Promise<{[key: string]: number}>;
  
  // Deck persistence
  createDeck(deck: InsertDeck): Promise<Deck>;
  getUserDecks(userId: number): Promise<Deck[]>;
  getDeck(id: number, userId: number): Promise<Deck | null>;
  updateDeck(id: number, userId: number, updates: Partial<InsertDeck>): Promise<Deck | null>;
  deleteDeck(id: number, userId: number): Promise<boolean>;
  
  // User deck management (one deck per user)
  getUserDeck(userId: string): Promise<{ deck: UserDeck | null, entries: DeckEntry[], commander?: Card }>;
  saveUserDeck(userId: string, deckData: Partial<InsertUserDeck>): Promise<UserDeck>;
  
  // Deck import functionality
  importDeckFromText(userId: string, deckText: string, format?: string): Promise<{ success: boolean, message: string, importedCards: number, failedCards: string[] }>;

  // Synergy and similarity methods
  findSynergyCards(sourceCard: Card, filters?: any): Promise<Array<{cardId: string, score: number, reason: string}>>;
  findFunctionallySimilarCards(sourceCard: Card, filters?: any): Promise<Array<{cardId: string, score: number, reason: string}>>;
}

export class DatabaseStorage implements IStorage {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for card cache
  private readonly SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hour for search cache

  private generateQueryHash(filters: SearchFilters, page: number): string {
    const queryString = JSON.stringify({ filters, page });
    return crypto.createHash('md5').update(queryString).digest('hex');
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    try {
      // Check cache first
      const cachedResult = await this.getCachedSearchResults(filters, page);
      if (cachedResult) {
        return cachedResult;
      }

      // Use Scryfall service for live search
      const result = await scryfallService.searchCards(filters, page);
      
      // Cache cards individually
      for (const card of result.data) {
        await this.cacheCard(card);
      }
      
      // Cache search results
      await this.cacheSearchResults(filters, page, result);
      
      return result;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async getCard(id: string): Promise<Card | null> {
    try {
      // Try cache first
      const cached = await this.getCachedCard(id);
      if (cached) {
        return cached;
      }
      
      // Fetch from Scryfall
      const card = await scryfallService.getCard(id);
      if (card) {
        await this.cacheCard(card);
      }
      
      return card;
    } catch (error) {
      console.error('Get card error:', error);
      return null;
    }
  }

  async getRandomCard(): Promise<Card> {
    try {
      const card = await scryfallService.getRandomCard();
      await this.cacheCard(card);
      return card;
    } catch (error) {
      console.error('Random card error:', error);
      throw error;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, parseInt(id))).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async cacheCard(card: Card): Promise<void> {
    try {
      await db.insert(cardCache)
        .values({
          id: card.id,
          cardData: card,
          lastUpdated: new Date(),
          searchCount: 1
        })
        .onConflictDoUpdate({
          target: cardCache.id,
          set: {
            cardData: card,
            lastUpdated: new Date(),
            searchCount: sql`${cardCache.searchCount} + 1`
          }
        });
    } catch (error) {
      console.error('Cache card error:', error);
    }
  }

  async getCachedCard(id: string): Promise<Card | null> {
    try {
      const [cached] = await db.select()
        .from(cardCache)
        .where(eq(cardCache.id, id))
        .limit(1);
      
      if (cached && (Date.now() - cached.lastUpdated.getTime()) < this.CACHE_TTL) {
        return cached.cardData;
      }
      
      return null;
    } catch (error) {
      console.error('Get cached card error:', error);
      return null;
    }
  }

  async cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      await db.insert(searchCache)
        .values({
          queryHash,
          query: JSON.stringify({ filters, page }),
          results,
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 1
        })
        .onConflictDoUpdate({
          target: searchCache.queryHash,
          set: {
            results,
            lastAccessed: new Date(),
            accessCount: sql`${searchCache.accessCount} + 1`
          }
        });
    } catch (error) {
      console.error('Cache search results error:', error);
    }
  }

  async getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      const [cached] = await db.select()
        .from(searchCache)
        .where(eq(searchCache.queryHash, queryHash))
        .limit(1);
      
      if (cached && (Date.now() - cached.lastAccessed.getTime()) < this.SEARCH_CACHE_TTL) {
        // Update access time
        await db.update(searchCache)
          .set({ lastAccessed: new Date() })
          .where(eq(searchCache.queryHash, queryHash));
        
        return cached.results;
      }
      
      return null;
    } catch (error) {
      console.error('Get cached search results error:', error);
      return null;
    }
  }

  async cleanupOldCache(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.CACHE_TTL);
      await db.delete(cardCache)
        .where(sql`${cardCache.lastUpdated} < ${cutoff}`);
      
      const searchCutoff = new Date(Date.now() - this.SEARCH_CACHE_TTL);
      await db.delete(searchCache)
        .where(sql`${searchCache.lastAccessed} < ${searchCutoff}`);
    } catch (error) {
      console.error('Cleanup cache error:', error);
    }
  }

  async recordUserInteraction(interaction: InsertUserInteraction): Promise<void> {
    try {
      await db.insert(userInteractions).values(interaction);
    } catch (error) {
      console.error('Record interaction error:', error);
    }
  }

  async getUserInteractions(userId: number, limit: number = 100): Promise<UserInteraction[]> {
    return db.select()
      .from(userInteractions)
      .where(eq(userInteractions.userId, userId))
      .orderBy(desc(userInteractions.createdAt))
      .limit(limit);
  }

  async getCardRecommendations(cardId: string, type: 'synergy' | 'functional_similarity', limit: number = 10, filters?: any): Promise<CardRecommendation[]> {
    return db.select()
      .from(cardRecommendations)
      .where(and(
        eq(cardRecommendations.sourceCardId, cardId),
        eq(cardRecommendations.recommendationType, type)
      ))
      .orderBy(desc(cardRecommendations.score))
      .limit(limit);
  }

  async recordRecommendationFeedback(feedback: InsertRecommendationFeedback): Promise<void> {
    try {
      await db.insert(recommendationFeedback).values(feedback);
    } catch (error) {
      console.error('Record recommendation feedback error:', error);
    }
  }

  async getRecommendationWeights(): Promise<{[key: string]: number}> {
    // Simple implementation - in practice this would analyze feedback
    return {
      'synergy': 1.0,
      'functional_similarity': 0.8,
      'theme': 0.9
    };
  }

  async findCardsBySharedThemes(
    sourceCard: Card, 
    sourceThemes: Array<{theme: string, description: string, confidence: number, cards: Card[]}>, 
    filters?: any
  ): Promise<Array<{card: Card, sharedThemes: Array<{theme: string, score: number}>, synergyScore: number, reason: string}>> {
    const synergies: Array<{card: Card, sharedThemes: Array<{theme: string, score: number}>, synergyScore: number, reason: string}> = [];
    
    // Get source card's theme scores for comparison
    const sourceCardThemes = await this.getCardThemes(sourceCard.id);
    const sourceThemeScores = Object.fromEntries(
      sourceCardThemes.map(t => [t.theme_name, t.final_score])
    );
    
    for (const theme of sourceThemes) {
      for (const card of theme.cards) {
        if (card.id === sourceCard.id) continue;
        
        // Get target card's theme scores
        const targetCardThemes = await this.getCardThemes(card.id);
        const targetThemeScore = targetCardThemes.find(t => t.theme_name === theme.theme)?.final_score || 0;
        const sourceThemeScore = sourceThemeScores[theme.theme] || 0;
        
        // Calculate dynamic synergy score: average of both cards' theme scores
        const dynamicScore = (targetThemeScore + sourceThemeScore) / 2;
        
        const existingEntry = synergies.find(s => s.card.id === card.id);
        if (existingEntry) {
          existingEntry.sharedThemes.push({ theme: theme.theme, score: dynamicScore });
          existingEntry.synergyScore += dynamicScore;
        } else {
          synergies.push({
            card,
            sharedThemes: [{ theme: theme.theme, score: dynamicScore }],
            synergyScore: dynamicScore,
            reason: `Shares ${theme.theme} theme`
          });
        }
      }
    }
    
    return synergies.sort((a, b) => b.synergyScore - a.synergyScore);
  }

  async getCardThemes(cardId: string): Promise<CardTheme[]> {
    return db.select()
      .from(cardThemes)
      .where(eq(cardThemes.card_id, cardId))
      .orderBy(desc(cardThemes.final_score)); // Sort by unified score
  }

  async createCardTheme(theme: InsertCardTheme): Promise<CardTheme> {
    const [result] = await db.insert(cardThemes).values(theme).returning();
    return result;
  }

  async updateCardThemeVotes(cardId: string, themeName: string, upvotes: number, downvotes: number): Promise<void> {
    // Calculate new final score using the same logic as routes
    const baseConfidence = 50;
    const totalVotes = upvotes + downvotes;
    const netVotes = upvotes - downvotes;
    
    let voteImpact = 0;
    if (totalVotes > 0) {
      const diminishingFactor = Math.max(0.1, 1 / Math.sqrt(totalVotes));
      voteImpact = netVotes * Math.max(1, 10 * diminishingFactor);
    }
    
    const finalScore = Math.max(0, Math.min(100, Math.round(baseConfidence + voteImpact)));
    
    await db.update(cardThemes)
      .set({ 
        user_upvotes: upvotes,
        user_downvotes: downvotes,
        final_score: finalScore,
        last_updated: new Date() 
      })
      .where(and(eq(cardThemes.card_id, cardId), eq(cardThemes.theme_name, themeName)));
  }

  async findCardsByThemes(themes: string[], filters?: any): Promise<Card[]> {
    if (themes.length === 0) return [];
    
    const cardIds = await db.select({ 
      cardId: cardThemes.card_id,
      confidence: sql<number>`AVG(${cardThemes.confidence})`.as('avg_confidence')
    })
      .from(cardThemes)
      .where(inArray(cardThemes.theme_name, themes))
      .groupBy(cardThemes.card_id)
      .having(sql`COUNT(DISTINCT ${cardThemes.theme_name}) >= ${Math.min(themes.length, 2)}`)
      .orderBy(desc(sql`AVG(${cardThemes.confidence})`));
    
    if (cardIds.length === 0) return [];
    
    const cachedCards = await db.select()
      .from(cardCache)
      .where(inArray(cardCache.id, cardIds.map(c => c.cardId)));
    
    let cards = cachedCards.map(c => c.cardData);
    
    if (filters) {
      cards = cards.filter(card => cardMatchesFilters(card, filters));
    }
    
    return cards;
  }

  async getThemeRelationships(theme: string): Promise<ThemeRelationship[]> {
    return db.select()
      .from(themeRelationships)
      .where(or(eq(themeRelationships.sourceTheme, theme), eq(themeRelationships.targetTheme, theme)))
      .orderBy(desc(themeRelationships.synergyScore));
  }

  async createThemeRelationship(relationship: InsertThemeRelationship): Promise<ThemeRelationship> {
    const [result] = await db.insert(themeRelationships).values(relationship).returning();
    return result;
  }

  async recordUserThemeFeedback(feedback: InsertUserThemeFeedback): Promise<void> {
    await db.insert(userThemeFeedback).values(feedback);
  }

  async calculateThemeSynergyScore(sourceThemes: string[], targetThemes: string[]): Promise<{score: number, reason: string}> {
    if (sourceThemes.length === 0 || targetThemes.length === 0) {
      return { score: 0, reason: "No themes to compare" };
    }

    // Find shared themes
    const sharedThemes = sourceThemes.filter(theme => targetThemes.includes(theme));
    
    if (sharedThemes.length > 0) {
      const sharedScore = sharedThemes.length / Math.max(sourceThemes.length, targetThemes.length);
      return { 
        score: Math.min(sharedScore * 1.5, 1.0), 
        reason: `Shares ${sharedThemes.length} theme(s): ${sharedThemes.join(', ')}` 
      };
    }

    // Check theme relationships
    let maxSynergyScore = 0;
    let bestRelationship = '';
    
    for (const sourceTheme of sourceThemes) {
      const relationships = await this.getThemeRelationships(sourceTheme);
      
      for (const relationship of relationships) {
        const relatedTheme = relationship.sourceTheme === sourceTheme ? 
          relationship.targetTheme : relationship.sourceTheme;
        
        if (targetThemes.includes(relatedTheme) && relationship.synergyScore > maxSynergyScore) {
          maxSynergyScore = relationship.synergyScore;
          bestRelationship = `${sourceTheme} synergizes with ${relatedTheme}`;
        }
      }
    }

    return { 
      score: maxSynergyScore, 
      reason: bestRelationship || "No theme synergy found" 
    };
  }

  async createDeck(deck: InsertDeck): Promise<Deck> {
    const [result] = await db.insert(decks).values(deck).returning();
    return result;
  }

  async getUserDecks(userId: number): Promise<Deck[]> {
    return db.select()
      .from(decks)
      .where(eq(decks.userId, userId))
      .orderBy(desc(decks.updatedAt));
  }

  async getDeck(id: number, userId: number): Promise<Deck | null> {
    const [deck] = await db.select()
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.userId, userId)))
      .limit(1);
    return deck || null;
  }

  async updateDeck(id: number, userId: number, updates: Partial<InsertDeck>): Promise<Deck | null> {
    const [deck] = await db.update(decks)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(decks.id, id), eq(decks.userId, userId)))
      .returning();
    return deck || null;
  }

  async deleteDeck(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(decks)
      .where(and(eq(decks.id, id), eq(decks.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getUserDeck(userId: string): Promise<{ deck: UserDeck | null, entries: DeckEntry[], commander?: Card }> {
    try {
      const [deck] = await db.select().from(userDecks).where(eq(userDecks.userId, userId));
      
      if (!deck) {
        return { deck: null, entries: [], commander: undefined };
      }

      const entries: DeckEntry[] = [];
      const commander = deck.commanderId ? await this.getCard(deck.commanderId) : undefined;
      
      // Convert stored cards to deck entries
      if (deck.cards && Array.isArray(deck.cards)) {
        for (const cardData of deck.cards as Array<{cardId: string, quantity: number}>) {
          const card = await this.getCard(cardData.cardId);
          if (card) {
            entries.push({ card, quantity: cardData.quantity });
          }
        }
      }

      return { 
        deck, 
        entries, 
        commander: commander || undefined 
      };
    } catch (error) {
      console.error('Error getting user deck:', error);
      return { deck: null, entries: [], commander: undefined };
    }
  }

  async saveUserDeck(userId: string, deckData: Partial<InsertUserDeck>): Promise<UserDeck> {
    try {
      const [deck] = await db
        .insert(userDecks)
        .values({
          userId,
          ...deckData,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: userDecks.userId,
          set: {
            ...deckData,
            updatedAt: new Date()
          }
        })
        .returning();
      
      return deck;
    } catch (error) {
      console.error('Error saving user deck:', error);
      throw error;
    }
  }

  async importDeckFromText(userId: string, deckText: string, format: string = "Commander"): Promise<{ success: boolean, message: string, importedCards: number, failedCards: string[] }> {
    const lines = deckText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const failedCards: string[] = [];
    const importedCards: Array<{ cardId: string, quantity: number }> = [];
    let commanderId: string | null = null;
    let deckName = "Imported Deck";

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('//') || line.startsWith('#') || line.length === 0) {
        continue;
      }

      // Check for deck name
      if (line.toLowerCase().startsWith('deck:') || line.toLowerCase().startsWith('name:')) {
        deckName = line.split(':')[1]?.trim() || deckName;
        continue;
      }

      // Parse card line (format: "quantity cardname" or "quantity x cardname")
      const cardMatch = line.match(/^(\d+)\s*(?:x\s*)?(.+?)(?:\s*\(.*\))?$/i);
      if (!cardMatch) {
        // Try without quantity (assume 1)
        const simpleMatch = line.match(/^(.+?)(?:\s*\(.*\))?$/i);
        if (simpleMatch) {
          const cardName = simpleMatch[1].trim();
          const cards = await this.searchCardsByName(cardName);
          if (cards.length > 0) {
            const isCommander = line.toLowerCase().includes('commander') || 
                              line.toLowerCase().includes('*') ||
                              (format.toLowerCase() === 'commander' && !commanderId);
            
            if (isCommander && format.toLowerCase() === 'commander') {
              commanderId = cards[0].id;
            } else {
              importedCards.push({ cardId: cards[0].id, quantity: 1 });
            }
          } else {
            failedCards.push(cardName);
          }
        }
        continue;
      }

      const quantity = parseInt(cardMatch[1]);
      const cardName = cardMatch[2].trim();

      // Search for the card
      const cards = await this.searchCardsByName(cardName);
      if (cards.length > 0) {
        const isCommander = line.toLowerCase().includes('commander') || 
                          line.toLowerCase().includes('*') ||
                          (format.toLowerCase() === 'commander' && !commanderId && quantity === 1);
        
        if (isCommander && format.toLowerCase() === 'commander') {
          commanderId = cards[0].id;
        } else {
          importedCards.push({ cardId: cards[0].id, quantity });
        }
      } else {
        failedCards.push(cardName);
      }
    }

    // Save the imported deck
    const deckData: Partial<InsertUserDeck> = {
      name: deckName,
      format: format,
      commanderId: commanderId,
      cards: importedCards
    };

    await this.saveUserDeck(userId, deckData);

    return {
      success: true,
      message: `Imported ${importedCards.length} cards successfully${failedCards.length > 0 ? `, ${failedCards.length} cards failed to import` : ''}`,
      importedCards: importedCards.length,
      failedCards
    };
  }

  private async searchCardsByName(cardName: string): Promise<Card[]> {
    try {
      // Try exact name match first from cache
      const exactResults = await db.select()
        .from(cardCache)
        .where(sql`LOWER(${cardCache.cardData}->>'name') = LOWER(${cardName})`)
        .limit(5);

      if (exactResults.length > 0) {
        return exactResults.map(r => r.cardData);
      }

      // Fall back to Scryfall search
      const searchResult = await scryfallService.searchCards({ query: `!"${cardName}"` }, 1);
      return searchResult.data.slice(0, 5);
    } catch (error) {
      console.error('Search cards by name error:', error);
      return [];
    }
  }

  async findSynergyCards(sourceCard: Card, filters?: any): Promise<Array<{cardId: string, score: number, reason: string}>> {
    // Simple implementation - could be enhanced with AI analysis
    const synergies: Array<{cardId: string, score: number, reason: string}> = [];
    
    // Look for cards with similar colors
    if (sourceCard.colors && sourceCard.colors.length > 0) {
      const colorQuery = sourceCard.colors.map(color => `c:${color}`).join(' OR ');
      try {
        const result = await scryfallService.searchCards({ query: `(${colorQuery}) -"${sourceCard.name}"` }, 1);
        result.data.slice(0, 10).forEach((card, index) => {
          synergies.push({
            cardId: card.id,
            score: 80 - index * 5,
            reason: 'Shares color identity'
          });
        });
      } catch (error) {
        console.error('Synergy search error:', error);
      }
    }
    
    return synergies;
  }

  async findFunctionallySimilarCards(sourceCard: Card, filters?: any): Promise<Array<{cardId: string, score: number, reason: string}>> {
    const similarities: Array<{cardId: string, score: number, reason: string}> = [];
    
    // Look for cards with similar type line
    if (sourceCard.type_line) {
      const typeQuery = sourceCard.type_line.split(' ').slice(0, 2).join(' ');
      try {
        const result = await scryfallService.searchCards({ query: `t:"${typeQuery}" -"${sourceCard.name}"` }, 1);
        result.data.slice(0, 10).forEach((card, index) => {
          similarities.push({
            cardId: card.id,
            score: 85 - index * 5,
            reason: 'Similar card type'
          });
        });
      } catch (error) {
        console.error('Similarity search error:', error);
      }
    }
    
    return similarities;
  }
}

export const storage = new DatabaseStorage();