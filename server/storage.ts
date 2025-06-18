import { db } from "./db";
import { cardCache, searchCache, users, savedSearches, favoriteCards, cardRecommendations, userInteractions, recommendationFeedback, cardThemes } from "@shared/schema";
import { Card, SearchFilters, SearchResponse, User, InsertUser, SavedSearch, InsertSavedSearch, FavoriteCard, InsertFavoriteCard, CardRecommendation, InsertCardRecommendation, UserInteraction, InsertUserInteraction, InsertRecommendationFeedback } from "@shared/schema";
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
  
  // Recommendation system
  getCardRecommendations(cardId: string, type: 'synergy' | 'functional_similarity', limit?: number): Promise<CardRecommendation[]>;
  generateRecommendationsForCard(cardId: string): Promise<void>;
  getPersonalizedRecommendations(userId: number, limit?: number): Promise<Card[]>;
  
  // Feedback system
  recordRecommendationFeedback(feedback: InsertRecommendationFeedback): Promise<void>;
  getRecommendationWeights(): Promise<{[key: string]: number}>;
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
        .where(eq(cardCache.cardId, id));
      
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
      .values(search)
      .returning();
    return savedSearch;
  }

  async deleteSavedSearch(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
    
    return result.rowCount > 0;
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
    
    return result.rowCount > 0;
  }

  async cacheCard(card: Card): Promise<void> {
    try {
      await db.insert(cardCache).values({
        cardId: card.id,
        cardData: card,
        searchCount: 1
      }).onConflictDoUpdate({
        target: cardCache.cardId,
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
        .where(eq(cardCache.cardId, id));
      
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

  async getCardRecommendations(cardId: string, type: 'synergy' | 'functional_similarity', limit: number = 10): Promise<CardRecommendation[]> {
    return db.select()
      .from(cardRecommendations)
      .where(and(
        eq(cardRecommendations.cardId, cardId),
        eq(cardRecommendations.recommendationType, type)
      ))
      .orderBy(desc(cardRecommendations.score))
      .limit(limit);
  }

  async generateRecommendationsForCard(cardId: string): Promise<void> {
    try {
      const sourceCard = await this.getCard(cardId);
      if (!sourceCard) return;

      // Clear existing recommendations
      await db.delete(cardRecommendations)
        .where(eq(cardRecommendations.cardId, cardId));

      // Generate synergy recommendations
      const synergyCards = await this.findSynergyCards(sourceCard);
      const synergyRecommendations = synergyCards.map(rec => ({
        cardId: sourceCard.id,
        recommendedCardId: rec.cardId,
        recommendationType: 'synergy' as const,
        score: rec.score,
        reason: rec.reason
      }));

      // Generate functional similarity recommendations
      const similarCards = await this.findFunctionallySimarCards(sourceCard);
      const similarRecommendations = similarCards.map(rec => ({
        cardId: sourceCard.id,
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
    return this.findFunctionallySimarCards(sourceCard);
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
      for (const cardId of Array.from(recommendations).slice(0, limit)) {
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
  private async findSynergyCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    const synergies: Array<{cardId: string, score: number, reason: string}> = [];
    
    // Get more cards for better synergy detection
    const sampleCards = await db
      .select()
      .from(cardCache)
      .where(sql`card_data->>'id' != ${sourceCard.id}`)
      .limit(500);

    const sourceText = (sourceCard.oracle_text || '').toLowerCase();
    const sourceType = sourceCard.type_line.toLowerCase();

    for (const cached of sampleCards) {
      const card = cached.cardData;
      const cardText = (card.oracle_text || '').toLowerCase();
      const cardType = card.type_line.toLowerCase();
      let score = 0;
      const reasons: string[] = [];

      // ENABLER-PAYOFF RELATIONSHIPS
      
      // Source creates tokens -> Card benefits from tokens
      if ((sourceText.includes('create') && sourceText.includes('token')) &&
          (cardText.includes('sacrifice') || cardText.includes('token') && cardText.includes('get'))) {
        score += 35; reasons.push('token generator-consumer');
      }

      // Source mills -> Card benefits from graveyard
      if (sourceText.includes('mill') && 
          (cardText.includes('graveyard') || cardText.includes('return') && cardText.includes('graveyard'))) {
        score += 30; reasons.push('mill enabler-graveyard payoff');
      }

      // Source ramps -> Card has high mana cost
      if ((sourceText.includes('add') && sourceText.includes('mana')) && card.cmc >= 6) {
        score += 25; reasons.push('ramp enables expensive spell');
      }

      // Source creates artifacts -> Card has metalcraft/artifact synergy
      if ((sourceType.includes('artifact') || sourceText.includes('artifact')) &&
          (cardText.includes('metalcraft') || cardText.includes('artifact') && cardText.includes('control'))) {
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

      if (score >= 20) {
        synergies.push({
          cardId: card.id,
          score: Math.min(score, 100),
          reason: reasons.join(', ')
        });
      }
    }

    return synergies.sort((a, b) => b.score - a.score).slice(0, 12);
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
  private async findFunctionallySimarCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    const functionalCards: Array<{cardId: string, score: number, reason: string}> = [];
    
    // Get sample of cards to analyze
    const sampleCards = await db
      .select()
      .from(cardCache)
      .where(sql`card_data->>'id' != ${sourceCard.id}`)
      .limit(400);

    const sourceText = (sourceCard.oracle_text || '').toLowerCase();
    const sourceType = sourceCard.type_line.toLowerCase();

    for (const cached of sampleCards) {
      const card = cached.cardData;
      const cardText = (card.oracle_text || '').toLowerCase();
      const cardType = card.type_line.toLowerCase();
      let score = 0;
      const reasons: string[] = [];

      // FUNCTIONAL SIMILARITY (cards that do similar things)
      
      // Same primary function patterns
      const functionPatterns = [
        { source: 'counter target spell', target: 'counter target spell', weight: 45, reason: 'counterspell' },
        { source: 'destroy target creature', target: 'destroy target creature', weight: 40, reason: 'creature removal' },
        { source: 'draw.*card', target: 'draw.*card', weight: 35, reason: 'card draw' },
        { source: 'deal.*damage', target: 'deal.*damage', weight: 30, reason: 'direct damage' },
        { source: 'gain.*life', target: 'gain.*life', weight: 25, reason: 'lifegain' },
        { source: 'search.*library', target: 'search.*library', weight: 35, reason: 'tutoring' },
        { source: 'return.*graveyard', target: 'return.*graveyard', weight: 40, reason: 'recursion' },
        { source: 'exile target', target: 'exile target', weight: 35, reason: 'exile removal' }
      ];

      for (const pattern of functionPatterns) {
        if (sourceText.match(pattern.source) && cardText.match(pattern.target)) {
          score += pattern.weight;
          reasons.push(pattern.reason);
          break; // Only count one primary function
        }
      }

      // Mana cost similarity (key for functional replacements)
      const cmcDiff = Math.abs(sourceCard.cmc - card.cmc);
      if (cmcDiff <= 1) {
        score += 20; reasons.push('similar cost');
      } else if (cmcDiff <= 2) {
        score += 10; reasons.push('comparable cost');
      }

      // Type similarity (creatures vs creatures, etc)
      const sourceMainType = sourceType.split(' ')[0];
      const cardMainType = cardType.split(' ')[0];
      if (sourceMainType === cardMainType) {
        score += 15; reasons.push('same type');
        
        // For creatures, compare stats
        if (sourceMainType === 'creature' && sourceCard.power && card.power) {
          const powerDiff = Math.abs(parseInt(sourceCard.power) - parseInt(card.power));
          const toughnessDiff = Math.abs(parseInt(sourceCard.toughness || '0') - parseInt(card.toughness || '0'));
          
          if (powerDiff <= 1 && toughnessDiff <= 1) {
            score += 20; reasons.push('similar stats');
          }
        }
      }

      // Color identity similarity
      const sourceColors = sourceCard.color_identity || [];
      const cardColors = card.color_identity || [];
      const colorOverlap = sourceColors.filter(c => cardColors.includes(c)).length;
      const totalColors = Math.max(sourceColors.length, cardColors.length);
      
      if (totalColors > 0) {
        const colorSimilarity = colorOverlap / totalColors;
        if (colorSimilarity >= 0.8) {
          score += 15; reasons.push('same colors');
        } else if (colorSimilarity >= 0.5) {
          score += 8; reasons.push('similar colors');
        }
      }

      // Keyword similarity
      const sourceKeywords = this.extractKeywords(sourceText);
      const cardKeywords = this.extractKeywords(cardText);
      const sharedKeywords = sourceKeywords.filter(k => cardKeywords.includes(k));
      
      if (sharedKeywords.length > 0) {
        score += sharedKeywords.length * 8;
        reasons.push(`shared abilities: ${sharedKeywords.join(', ')}`);
      }

      if (score >= 25) {
        functionalCards.push({
          cardId: card.id,
          score: Math.min(score, 100),
          reason: reasons.join(', ')
        });
      }
    }

    return functionalCards.sort((a, b) => b.score - a.score).slice(0, 12);
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
    try {
      // Analyze feedback to adjust weights
      const feedbackData = await db
        .select()
        .from(recommendationFeedback);

      const weights: {[key: string]: number} = {
        'oracle_text_match': 1.0,
        'type_match': 0.8,
        'synergy_bonus': 1.2,
        'mana_cost_similarity': 0.3
      };

      // Adjust weights based on feedback
      const helpfulCount = feedbackData.filter(f => f.feedback === 'helpful').length;
      const totalCount = feedbackData.length;
      
      if (totalCount > 10) {
        const helpfulRatio = helpfulCount / totalCount;
        if (helpfulRatio < 0.6) {
          // If less than 60% helpful, adjust weights
          weights.oracle_text_match *= 1.2;
          weights.synergy_bonus *= 1.1;
          weights.mana_cost_similarity *= 0.8;
        }
      }

      return weights;
    } catch (error) {
      console.error('Error getting recommendation weights:', error);
      return {
        'oracle_text_match': 1.0,
        'type_match': 0.8,
        'synergy_bonus': 1.2,
        'mana_cost_similarity': 0.3
      };
    }
  }
}

export const storage = new DatabaseStorage();