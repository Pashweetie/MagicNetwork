import { db } from "./db";
import { cardCache, searchCache, users, savedSearches, favoriteCards, cardRecommendations, userInteractions, recommendationFeedback, cardThemes, decks } from "@shared/schema";
import { Card, SearchFilters, SearchResponse, User, InsertUser, SavedSearch, InsertSavedSearch, FavoriteCard, InsertFavoriteCard, CardRecommendation, InsertCardRecommendation, UserInteraction, InsertUserInteraction, InsertRecommendationFeedback, Deck, InsertDeck } from "@shared/schema";
import { eq, sql, and, desc, asc } from "drizzle-orm";
import crypto from "crypto";
import { scryfallService } from "./services/scryfall";

export interface IStorage {
  // Card search methods
  searchCards(filters: SearchFilters, page: number): Promise<SearchResponse>;
  getCard(id: string): Promise<Card | null>;
  getRandomCard(): Promise<Card>;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Saved searches
  getSavedSearches(userId: number): Promise<SavedSearch[]>;
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  deleteSavedSearch(id: number, userId: number): Promise<boolean>;
  
  // Favorite cards
  getFavoriteCards(userId: number): Promise<FavoriteCard[]>;
  addFavoriteCard(favorite: InsertFavoriteCard): Promise<FavoriteCard>;
  removeFavoriteCard(cardId: string, userId: number): Promise<boolean>;
  
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
  
  // Feedback system
  recordRecommendationFeedback(feedback: InsertRecommendationFeedback): Promise<void>;
  getRecommendationWeights(): Promise<{[key: string]: number}>;
  
  // Deck persistence
  createDeck(deck: InsertDeck): Promise<Deck>;
  getUserDecks(userId: number): Promise<Deck[]>;
  getDeck(id: number, userId: number): Promise<Deck | null>;
  updateDeck(id: number, userId: number, updates: Partial<InsertDeck>): Promise<Deck | null>;
  deleteDeck(id: number, userId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for card cache
  private readonly SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hour for search cache

  private generateQueryHash(filters: SearchFilters, page: number): string {
    const query = JSON.stringify({ filters, page });
    return crypto.createHash('md5').update(query).digest('hex');
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    // Check cache first
    const cached = await this.getCachedSearchResults(filters, page);
    if (cached) {
      // Update access count
      const queryHash = this.generateQueryHash(filters, page);
      await db.update(searchCache)
        .set({ 
          lastAccessed: new Date(),
          accessCount: sql`${searchCache.accessCount} + 1`
        })
        .where(eq(searchCache.queryHash, queryHash));
      
      return cached;
    }

    // Search using Scryfall service
    const results = await scryfallService.searchCards(filters, page);
    
    // Cache the results
    await this.cacheSearchResults(filters, page, results);
    
    // Cache individual cards
    for (const card of results.data) {
      await this.cacheCard(card);
    }

    return results;
  }

  async getCard(id: string): Promise<Card | null> {
    // Check cache first
    const cached = await this.getCachedCard(id);
    if (cached) {
      // Update search count
      await db.update(cardCache)
        .set({ searchCount: sql`${cardCache.searchCount} + 1` })
        .where(eq(cardCache.id, id));
      
      return cached;
    }

    // Fetch from Scryfall
    const card = await scryfallService.getCard(id);
    if (card) {
      await this.cacheCard(card);
    }
    
    return card;
  }

  async getRandomCard(): Promise<Card> {
    return scryfallService.getRandomCard();
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getSavedSearches(userId: number): Promise<SavedSearch[]> {
    return db.select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.createdAt));
  }

  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [savedSearch] = await db
      .insert(savedSearches)
      .values({
        name: search.name,
        userId: search.userId,
        filters: search.filters
      })
      .returning();
    return savedSearch;
  }

  async deleteSavedSearch(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
    
    return (result.rowCount || 0) > 0;
  }

  async getFavoriteCards(userId: number): Promise<FavoriteCard[]> {
    return db.select()
      .from(favoriteCards)
      .where(eq(favoriteCards.userId, userId))
      .orderBy(desc(favoriteCards.createdAt));
  }

  async addFavoriteCard(favorite: InsertFavoriteCard): Promise<FavoriteCard> {
    const [favoriteCard] = await db
      .insert(favoriteCards)
      .values(favorite)
      .returning();
    return favoriteCard;
  }

  async removeFavoriteCard(cardId: string, userId: number): Promise<boolean> {
    const result = await db
      .delete(favoriteCards)
      .where(and(eq(favoriteCards.cardId, cardId), eq(favoriteCards.userId, userId)));
    
    return (result.rowCount || 0) > 0;
  }

  async cacheCard(card: Card): Promise<void> {
    try {
      await db.insert(cardCache).values({
        id: card.id,
        cardData: card,
        searchCount: 1
      }).onConflictDoUpdate({
        target: cardCache.id,
        set: {
          cardData: card,
          lastUpdated: new Date()
        }
      });
    } catch (error) {
      console.error('Error caching card:', error);
    }
  }

  async getCachedCard(id: string): Promise<Card | null> {
    try {
      const [cached] = await db
        .select()
        .from(cardCache)
        .where(eq(cardCache.id, id));
      
      if (!cached) return null;
      
      // Check if cache is still valid
      const age = Date.now() - cached.lastUpdated.getTime();
      if (age > this.CACHE_TTL) {
        return null;
      }
      
      return cached.cardData as Card;
    } catch (error) {
      console.error('Error getting cached card:', error);
      return null;
    }
  }

  async cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      
      await db.insert(searchCache).values({
        queryHash,
        query: JSON.stringify({ filters, page }),
        results: results,
        accessCount: 1
      }).onConflictDoUpdate({
        target: searchCache.queryHash,
        set: {
          results: results,
          lastAccessed: new Date()
        }
      });
    } catch (error) {
      console.error('Error caching search results:', error);
    }
  }

  async getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      
      const [cached] = await db
        .select()
        .from(searchCache)
        .where(eq(searchCache.queryHash, queryHash));
      
      if (!cached) return null;
      
      // Check if cache is still valid
      const age = Date.now() - cached.lastAccessed.getTime();
      if (age > this.SEARCH_CACHE_TTL) {
        return null;
      }
      
      return cached.results as SearchResponse;
    } catch (error) {
      console.error('Error getting cached search results:', error);
      return null;
    }
  }

  async cleanupOldCache(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.CACHE_TTL);
      
      // Clean up old card cache
      await db.delete(cardCache)
        .where(sql`${cardCache.lastUpdated} < ${cutoffDate}`);
      
      // Clean up old search cache
      await db.delete(searchCache)
        .where(sql`${searchCache.lastAccessed} < ${cutoffDate}`);
      
      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }

  async recordUserInteraction(interaction: InsertUserInteraction): Promise<void> {
    try {
      await db.insert(userInteractions).values(interaction);
    } catch (error) {
      console.error('Error recording user interaction:', error);
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
    // Get recommendations from database with cards joined
    const recommendations = await db.select()
      .from(cardRecommendations)
      .innerJoin(cardCache, eq(cardRecommendations.recommendedCardId, cardCache.id))
      .where(and(
        eq(cardRecommendations.sourceCardId, cardId),
        eq(cardRecommendations.recommendationType, type)
      ))
      .orderBy(desc(cardRecommendations.score))
      .limit(limit * 3); // Get more to filter from

    let result = recommendations.map(row => ({
      ...row.card_recommendations,
      card: row.card_cache.cardData as Card
    }));

    // Apply filters if provided
    if (filters) {
      result = result.filter(rec => {
        const card = rec.card;
        
        // Color filters
        if (filters.colors && filters.colors.length > 0) {
          const cardColors = card.colors || [];
          if (filters.includeMulticolored) {
            // Card must contain all specified colors
            if (!filters.colors.every((color: string) => cardColors.includes(color))) {
              return false;
            }
          } else {
            // Card must match at least one specified color
            if (!filters.colors.some((color: string) => cardColors.includes(color)) && cardColors.length > 0) {
              return false;
            }
          }
        }

        // Color identity filter (commander constraint)
        if (filters.colorIdentity && filters.colorIdentity.length > 0) {
          const cardIdentity = card.color_identity || [];
          // Card's color identity must be subset of allowed colors
          if (!cardIdentity.every((color: string) => filters.colorIdentity.includes(color))) {
            return false;
          }
        }

        // Type filters
        if (filters.types && filters.types.length > 0) {
          const cardTypes = card.type_line.toLowerCase();
          if (!filters.types.some((type: string) => cardTypes.includes(type.toLowerCase()))) {
            return false;
          }
        }

        // Mana value range
        if (filters.minMv !== undefined && card.cmc < filters.minMv) {
          return false;
        }
        if (filters.maxMv !== undefined && card.cmc > filters.maxMv) {
          return false;
        }

        // Format legality
        if (filters.format && filters.format !== 'all' && card.legalities) {
          const formatLegality = card.legalities[filters.format.toLowerCase()];
          if (formatLegality !== 'legal') return false;
        }

        // Set filter
        if (filters.set && filters.set !== 'all') {
          if (card.set !== filters.set) return false;
        }

        // Rarity filter
        if (filters.rarity && filters.rarity !== 'all') {
          if (card.rarity !== filters.rarity) return false;
        }
        
        return true;
      });
    }

    return result.slice(0, limit);
  }

  async generateRecommendationsForCard(cardId: string): Promise<void> {
    try {
      const sourceCard = await this.getCard(cardId);
      if (!sourceCard) return;

      // Clear existing recommendations
      await db.delete(cardRecommendations)
        .where(eq(cardRecommendations.sourceCardId, cardId));

      // Generate synergy recommendations
      const synergyCards = await this.findSynergyCards(sourceCard);
      const synergyRecommendations = synergyCards.map(rec => ({
        sourceCardId: sourceCard.id,
        recommendedCardId: rec.cardId,
        recommendationType: 'synergy' as const,
        score: rec.score,
        reason: rec.reason
      }));

      // Generate functional similarity recommendations
      const similarCards = await this.findFunctionallySimilarCards(sourceCard);
      const similarRecommendations = similarCards.map((rec: any) => ({
        sourceCardId: sourceCard.id,
        recommendedCardId: rec.cardId,
        recommendationType: 'functional_similarity' as const,
        score: rec.score,
        reason: rec.reason
      }));

      // Insert all recommendations
      if (synergyRecommendations.length > 0) {
        await db.insert(cardRecommendations).values(synergyRecommendations);
      }
      if (similarRecommendations.length > 0) {
        await db.insert(cardRecommendations).values(similarRecommendations);
      }

    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  }

  private async findSimilarCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    // This method is kept for compatibility but delegates to the more specific methods
    return this.findFunctionallySimilarCards(sourceCard);
  }

  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<Card[]> {
    try {
      // Get user interactions to understand preferences
      const interactions = await this.getUserInteractions(userId, 100);
      
      if (interactions.length === 0) {
        // Return random popular cards for new users
        const popularCards = await db
          .select()
          .from(cardCache)
          .orderBy(desc(cardCache.searchCount))
          .limit(limit);
        
        return popularCards.map(cached => cached.cardData as Card);
      }

      // Calculate preferences based on interactions
      const cardIds = interactions.map(i => i.cardId);
      const uniqueCardIds = [...new Set(cardIds)];
      
      // Get cards the user has interacted with
      const userCards: Card[] = [];
      for (const cardId of uniqueCardIds.slice(0, 10)) {
        const card = await this.getCard(cardId);
        if (card) userCards.push(card);
      }

      // Find recommendations based on user's cards
      const recommendations = new Set<string>();
      for (const card of userCards) {
        const recs = await this.getCardRecommendations(card.id, 'synergy', 5);
        recs.forEach(rec => recommendations.add(rec.recommendedCardId));
      }

      // Get the recommended cards
      const recommendedCards: Card[] = [];
      const cardIdArray = Array.from(recommendations);
      for (const cardId of cardIdArray.slice(0, limit)) {
        const card = await this.getCard(cardId);
        if (card) recommendedCards.push(card);
      }

      return recommendedCards;
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  private getInteractionWeight(interactionType: string): number {
    switch (interactionType) {
      case 'view': return 1;
      case 'search': return 2;
      case 'favorite': return 5;
      case 'add_to_deck': return 8;
      case 'recommendation_helpful': return 3;
      case 'recommendation_not_helpful': return -1;
      default: return 1;
    }
  }

  private getAgeWeight(createdAt: Date): number {
    const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 1) return 1.0;
    if (daysSince <= 7) return 0.8;
    if (daysSince <= 30) return 0.6;
    return 0.3;
  }

  // Find cards that synergize well (enabler-payoff relationships)
  async findSynergyCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    const synergies: Array<{cardId: string, score: number, reason: string}> = [];
    
    // Get recommendation weights for adjustment
    const weights = await this.getRecommendationWeights();
    const synergyWeight = weights['synergy'] || 1.0;
    
    // Get more cards for better synergy detection
    const sampleCards = await db
      .select()
      .from(cardCache)
      .where(sql`card_data->>'id' != ${sourceCard.id}`)
      .limit(800);

    const sourceText = (sourceCard.oracle_text || '').toLowerCase();
    const sourceType = sourceCard.type_line.toLowerCase();

    for (const cached of sampleCards) {
      const card = cached.cardData as Card;
      if (!card || !card.id) continue;
      
      const cardText = (card.oracle_text || '').toLowerCase();
      const cardType = card.type_line.toLowerCase();
      let score = 0;
      const reasons: string[] = [];

      // ENABLER-PAYOFF RELATIONSHIPS
      
      // Source creates tokens -> Card benefits from tokens
      if ((sourceText.includes('create') && sourceText.includes('token')) &&
          (cardText.includes('sacrifice') || (cardText.includes('token') && cardText.includes('get')))) {
        score += 35; reasons.push('token generator-consumer');
      }

      // Source mills -> Card benefits from graveyard
      if (sourceText.includes('mill') && 
          (cardText.includes('graveyard') || (cardText.includes('return') && cardText.includes('graveyard')))) {
        score += 30; reasons.push('mill enabler-graveyard payoff');
      }

      // Source ramps -> Card has high mana cost
      if ((sourceText.includes('add') && sourceText.includes('mana')) && card.cmc >= 6) {
        score += 25; reasons.push('ramp enables expensive spell');
      }

      // Source creates artifacts -> Card has metalcraft/artifact synergy
      if ((sourceType.includes('artifact') || sourceText.includes('artifact')) &&
          (cardText.includes('metalcraft') || (cardText.includes('artifact') && cardText.includes('control')))) {
        score += 30; reasons.push('artifact enabler-metalcraft payoff');
      }

      // Source has ETB -> Card bounces for reuse
      if (sourceText.includes('enters the battlefield') &&
          (cardText.includes('return') && cardText.includes('hand'))) {
        score += 25; reasons.push('ETB trigger-bounce engine');
      }

      // Source draws cards -> Card benefits from hand size
      if (sourceText.includes('draw') &&
          (cardText.includes('hand size') || cardText.includes('cards in hand'))) {
        score += 20; reasons.push('card draw-hand size payoff');
      }

      // Equipment + Creature synergies
      if (sourceType.includes('equipment') && cardType.includes('creature') &&
          (cardText.includes('equipped') || cardText.includes('hexproof') || cardText.includes('protection'))) {
        score += 30; reasons.push('equipment-creature synergy');
      }

      // Tribal synergies (same creature type)
      const sourceCreatureTypes = this.extractCreatureTypes(sourceCard.type_line);
      const cardCreatureTypes = this.extractCreatureTypes(card.type_line);
      const sharedTypes = sourceCreatureTypes.filter(type => cardCreatureTypes.includes(type));
      if (sharedTypes.length > 0 && (sourceText.includes(sharedTypes[0]) || cardText.includes(sharedTypes[0]))) {
        score += 20; reasons.push(`${sharedTypes[0]} tribal synergy`);
      }

      // Combo detection - cards that work together for powerful effects
      if (this.detectComboSynergy(sourceCard, card)) {
        score += 40; reasons.push('combo synergy');
      }

      // Apply centralized weight adjustment
      score = score * synergyWeight;

      if (score >= 15) {
        synergies.push({
          cardId: card.id,
          score: Math.min(score, 100),
          reason: reasons.join(', ')
        });
      }
    }

    return synergies.sort((a, b) => b.score - a.score).slice(0, 15);
  }

  private extractCreatureTypes(typeLine: string): string[] {
    const types = typeLine.toLowerCase();
    const creatureTypes = ['human', 'elf', 'goblin', 'wizard', 'soldier', 'beast', 'dragon', 'angel', 'demon', 'vampire', 'zombie', 'spirit'];
    return creatureTypes.filter(type => types.includes(type));
  }

  private detectComboSynergy(card1: Card, card2: Card): boolean {
    const text1 = (card1.oracle_text || '').toLowerCase();
    const text2 = (card2.oracle_text || '').toLowerCase();
    
    // Untap combos
    if ((text1.includes('untap') && text2.includes('tap')) ||
        (text1.includes('tap') && text2.includes('untap'))) {
      return true;
    }
    
    // Infinite mana combos
    if ((text1.includes('add') && text1.includes('mana')) &&
        (text2.includes('untap') || text2.includes('copy'))) {
      return true;
    }
    
    return false;
  }

  // Find functionally similar cards (alternatives/substitutes with similar effects)
  async findFunctionallySimilarCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    const similar: Array<{cardId: string, score: number, reason: string}> = [];
    
    console.log(`Finding functionally similar cards to ${sourceCard.name}`);
    
    // Get more cards for better similar card detection
    const sampleCards = await db
      .select()
      .from(cardCache)
      .where(sql`card_data->>'id' != ${sourceCard.id}`)
      .limit(1000);

    const sourceText = (sourceCard.oracle_text || '').toLowerCase();
    const sourceType = sourceCard.type_line.toLowerCase();
    const sourceCMC = sourceCard.cmc || 0;
    const sourceColors = sourceCard.color_identity || [];

    console.log(`Source card: ${sourceCard.name} (${sourceType}, CMC: ${sourceCMC})`);

    for (const cached of sampleCards) {
      const card = cached.cardData;
      const cardText = (card.oracle_text || '').toLowerCase();
      const cardType = card.type_line.toLowerCase();
      const cardCMC = card.cmc || 0;
      const cardColors = card.color_identity || [];
      let score = 0;
      const reasons: string[] = [];

      // FUNCTIONAL REPLACEMENT - same role in deck
      
      // 1. SIMILAR TYPE AND ROLE
      if (cardType === sourceType) {
        score += 30;
        reasons.push('same type');
      } else if (sourceType.includes('creature') && cardType.includes('creature')) {
        // Both creatures, check for similar roles
        const creatureTypes = ['human', 'beast', 'spirit', 'zombie', 'goblin', 'elf'];
        const sourceCreatureType = creatureTypes.find(type => sourceType.includes(type));
        const cardCreatureType = creatureTypes.find(type => cardType.includes(type));
        
        if (sourceCreatureType && cardCreatureType && sourceCreatureType === cardCreatureType) {
          score += 20;
          reasons.push(`both ${sourceCreatureType}s`);
        } else {
          score += 10;
          reasons.push('both creatures');
        }
      }

      // 2. SIMILAR MANA COST (functional replacements should cost similar)
      const costDiff = Math.abs(sourceCMC - cardCMC);
      if (costDiff === 0) {
        score += 25;
        reasons.push('same mana cost');
      } else if (costDiff === 1) {
        score += 15;
        reasons.push('similar mana cost');
      } else if (costDiff === 2) {
        score += 8;
      }

      // 3. COLOR OVERLAP (functional replacements often share colors)
      const colorOverlap = sourceColors.filter(c => cardColors.includes(c)).length;
      const totalColors = new Set([...sourceColors, ...cardColors]).size;
      
      if (sourceColors.length === cardColors.length && colorOverlap === sourceColors.length) {
        score += 20;
        reasons.push('same colors');
      } else if (colorOverlap > 0) {
        score += colorOverlap * 8;
        reasons.push('shared colors');
      }

      // 4. SIMILAR EFFECTS - key for functional similarity
      const effectAnalysis = this.analyzeSimilarEffects(sourceText, cardText);
      score += effectAnalysis.score;
      if (effectAnalysis.reasons.length > 0) {
        reasons.push(...effectAnalysis.reasons);
      }

      // 5. POWER/TOUGHNESS similarity for creatures
      if (sourceType.includes('creature') && cardType.includes('creature')) {
        const sourcePower = parseInt(sourceCard.power || '0');
        const sourceToughness = parseInt(sourceCard.toughness || '0');
        const cardPower = parseInt(card.power || '0');
        const cardToughness = parseInt(card.toughness || '0');
        
        const powerDiff = Math.abs(sourcePower - cardPower);
        const toughnessDiff = Math.abs(sourceToughness - cardToughness);
        
        if (powerDiff <= 1 && toughnessDiff <= 1) {
          score += 15;
          reasons.push('similar stats');
        }
      }

      // Only include cards that are actually functionally similar
      if (score >= 35 && reasons.length >= 2) {
        similar.push({
          cardId: card.id,
          score,
          reason: reasons.slice(0, 3).join(', ')
        });
      }
    }

    const results = similar.sort((a, b) => b.score - a.score).slice(0, 15);
    console.log(`Found ${results.length} functionally similar cards`);
    return results;
  }

  private analyzeSimilarEffects(sourceText: string, cardText: string): {score: number, reasons: string[]} {
    let score = 0;
    const reasons: string[] = [];

    // Define effect patterns that indicate functional similarity
    const effectPatterns = [
      { pattern: /draw.*card/g, name: 'card draw', weight: 15 },
      { pattern: /gain.*life/g, name: 'lifegain', weight: 12 },
      { pattern: /deal.*damage/g, name: 'direct damage', weight: 15 },
      { pattern: /destroy.*target/g, name: 'removal', weight: 18 },
      { pattern: /exile.*target/g, name: 'exile removal', weight: 18 },
      { pattern: /return.*hand/g, name: 'bounce', weight: 15 },
      { pattern: /search.*library/g, name: 'tutoring', weight: 20 },
      { pattern: /create.*token/g, name: 'token creation', weight: 16 },
      { pattern: /when.*enters/g, name: 'ETB trigger', weight: 14 },
      { pattern: /whenever.*dies/g, name: 'death trigger', weight: 14 },
      { pattern: /flash/g, name: 'flash', weight: 10 },
      { pattern: /flying/g, name: 'flying', weight: 8 },
      { pattern: /trample/g, name: 'trample', weight: 8 },
      { pattern: /vigilance/g, name: 'vigilance', weight: 8 }
    ];

    for (const { pattern, name, weight } of effectPatterns) {
      if (pattern.test(sourceText) && pattern.test(cardText)) {
        score += weight;
        reasons.push(name);
      }
    }

    return { score, reasons: reasons.slice(0, 2) }; // Limit to most important effects
  }

  // Deck persistence methods
  async createDeck(deck: InsertDeck): Promise<Deck> {
    const [newDeck] = await db.insert(decks).values(deck).returning();
    return newDeck;
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
      .where(and(eq(decks.id, id), eq(decks.userId, userId)));
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
    return (result.rowCount || 0) > 0;
  }

  private extractKeywords(text: string): string[] {
    const keywords = ['flying', 'trample', 'lifelink', 'deathtouch', 'vigilance', 'haste', 'reach', 
                     'first strike', 'double strike', 'hexproof', 'indestructible', 'flash', 'defender'];
    return keywords.filter(keyword => text.includes(keyword));
  }

  async recordRecommendationFeedback(feedback: InsertRecommendationFeedback): Promise<void> {
    try {
      await db.insert(recommendationFeedback).values(feedback);
    } catch (error) {
      console.error('Error recording recommendation feedback:', error);
    }
  }

  async getRecommendationWeights(): Promise<{[key: string]: number}> {
    return {
      'oracle_text_match': 1.0,
      'type_match': 0.8,
      'synergy_bonus': 1.2,
      'mana_cost_similarity': 0.3
    };
  }
}

export const storage = new DatabaseStorage();