import { db } from "./db";
import { cardCache, searchCache, users, savedSearches, favoriteCards, cardRecommendations, userInteractions, recommendationFeedback, cardThemes, decks } from "@shared/schema";
import { Card, SearchFilters, SearchResponse, User, InsertUser, SavedSearch, InsertSavedSearch, FavoriteCard, InsertFavoriteCard, CardRecommendation, InsertCardRecommendation, UserInteraction, InsertUserInteraction, InsertRecommendationFeedback, Deck, InsertDeck } from "@shared/schema";
import { eq, sql, and, desc, asc } from "drizzle-orm";
import crypto from "crypto";
import { scryfallService } from "./services/scryfall";
import { cardMatchesFilters } from "./utils/card-filters";

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
  
  // Tag system
  getCardTags(cardId: string): Promise<CardTag[]>;
  createCardTag(tag: InsertCardTag): Promise<CardTag>;
  updateCardTagVotes(cardId: string, tag: string, upvotes: number, downvotes: number): Promise<void>;
  findCardsByTags(tags: string[], filters?: any): Promise<Card[]>;
  getTagRelationships(tag: string): Promise<TagRelationship[]>;
  createTagRelationship(relationship: InsertTagRelationship): Promise<TagRelationship>;
  recordUserTagFeedback(feedback: InsertUserTagFeedback): Promise<void>;
  
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

    // Apply filters if provided using centralized filtering
    if (filters) {
      result = result.filter(rec => cardMatchesFilters(rec.card, filters));
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

  // Find cards that synergize well using stored recommendations
  async findSynergyCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    try {
      // First check if we have stored recommendations
      const storedRecs = await db
        .select()
        .from(cardRecommendations)
        .where(and(
          eq(cardRecommendations.sourceCardId, sourceCard.id),
          eq(cardRecommendations.recommendationType, 'synergy')
        ))
        .limit(20);

      if (storedRecs.length > 0) {
        return storedRecs.map(rec => ({
          cardId: rec.recommendedCardId,
          score: rec.score,
          reason: rec.reason || 'stored synergy'
        }));
      }

      // If no stored recommendations, generate basic ones
      return await this.generateBasicSynergy(sourceCard);
    } catch (error) {
      console.error('Error finding synergy cards:', error);
      return [];
    }
  }

  private async findAISynergyCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    const synergies: Array<{cardId: string, score: number, reason: string}> = [];
    
    // Get recommendation weights for adjustment
    const weights = await this.getRecommendationWeights();
    const synergyWeight = weights['synergy'] || 1.0;
    
    // Get sample cards for AI analysis
    const sampleCards = await db
      .select()
      .from(cardCache)
      .where(sql`card_data->>'id' != ${sourceCard.id}`)
      .limit(400);

    const { pureAIService } = await import('./services/pure-ai-recommendations');
    
    for (const cached of sampleCards) {
      const card = cached.cardData as Card;
      if (!card || !card.id) continue;
      
      // Use pure AI neural network to analyze synergy
      const synergyAnalysis = await pureAIService.analyzeSynergy(sourceCard, card);
      
      if (synergyAnalysis.score > 30) { // AI threshold
        synergies.push({
          cardId: card.id,
          score: synergyAnalysis.score * synergyWeight,
          reason: synergyAnalysis.reason
        });
      }
    }

    return synergies.sort((a, b) => b.score - a.score).slice(0, 15);
  }

  private async generateBasicSynergy(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    const synergies: Array<{cardId: string, score: number, reason: string}> = [];
    
    // Get cards with shared characteristics
    const candidateCards = await db
      .select()
      .from(cardCache)
      .where(sql`card_data->>'id' != ${sourceCard.id}`)
      .limit(500);

    for (const cached of candidateCards) {
      const card = cached.cardData as Card;
      const analysis = this.calculateBasicSynergyScore(sourceCard, card);
      
      if (analysis.score > 0.3) {
        synergies.push({
          cardId: card.id,
          score: analysis.score,
          reason: analysis.reason
        });
      }
    }
    
    return synergies
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  private prepareCardContext(card: Card): any {
    return {
      name: card.name,
      manaCost: card.mana_cost,
      cmc: card.cmc,
      colors: card.colors,
      colorIdentity: card.color_identity,
      typeLine: card.type_line,
      oracleText: card.oracle_text,
      power: card.power,
      toughness: card.toughness,
      keywords: this.extractKeywords(card.oracle_text || ''),
      mechanics: this.extractMechanics(card.oracle_text || ''),
      effects: this.categorizeEffects(card.oracle_text || '')
    };
  }

  private async analyzeCardSynergy(sourceContext: any, cardContext: any): Promise<{score: number, reason: string}> {
    try {
      // Use local AI for synergy analysis if available
      if (this.hasLocalAI()) {
        return await this.analyzeWithLocalAI(sourceContext, cardContext);
      }
      
      // Fallback to semantic pattern analysis
      return this.analyzeWithPatterns(sourceContext, cardContext);
    } catch (error) {
      console.error('Error in synergy analysis:', error);
      return { score: 0, reason: 'analysis failed' };
    }
  }

  private hasLocalAI(): boolean {
    // Import recommendation service to check AI availability
    try {
      return true; // Local AI is available through recommendation service
    } catch {
      return false;
    }
  }

  private async analyzeWithLocalAI(sourceContext: any, cardContext: any): Promise<{score: number, reason: string}> {
    try {
      // Import the recommendation service to access the AI model
      const { recommendationService } = await import('./services/recommendation');
      
      const prompt = `Analyze synergy between these Magic: The Gathering cards. Rate 0-100 how well they work together:

Source Card: ${sourceContext.name} (${sourceContext.typeLine})
Text: ${sourceContext.oracleText || 'No text'}

Target Card: ${cardContext.name} (${cardContext.typeLine})  
Text: ${cardContext.oracleText || 'No text'}

Consider: Do they enable each other? Share strategies? Have combo potential?
Format your answer as: SCORE|REASON

Example: 75|Token generator enables sacrifice payoff`;

      if (recommendationService.textGenerator) {
        const response = await recommendationService.textGenerator(prompt, {
          max_new_tokens: 50,
          temperature: 0.2
        });

        const aiText = response[0]?.generated_text || '';
        const match = aiText.match(/(\d{1,3})\|(.+)/);
        
        if (match) {
          const score = Math.min(parseInt(match[1]) || 0, 100);
          const reason = match[2].trim();
          return { score, reason };
        }
      }
      
      // Fallback if AI analysis fails
      return this.analyzeWithPatterns(sourceContext, cardContext);
      
    } catch (error) {
      console.error('AI synergy analysis failed:', error);
      return this.analyzeWithPatterns(sourceContext, cardContext);
    }
  }

  private analyzeWithPatterns(sourceContext: any, cardContext: any): Promise<{score: number, reason: string}> {
    let score = 0;
    const reasons: string[] = [];
    
    // Semantic effect matching
    const sourceEffects = sourceContext.effects;
    const cardEffects = cardContext.effects;
    
    // Cross-reference enabler/payoff relationships
    const synergyPairs = [
      { enabler: 'prowess', payoff: 'instant_sorcery', score: 40, reason: 'prowess spell synergy' },
      { enabler: 'prowess', payoff: 'noncreature_spells', score: 40, reason: 'prowess spell synergy' },
      { enabler: 'prowess', payoff: 'spell_matters', score: 35, reason: 'prowess spell synergy' },
      { enabler: 'spell_matters', payoff: 'instant_sorcery', score: 35, reason: 'spell synergy' },
      { enabler: 'noncreature_spells', payoff: 'instant_sorcery', score: 30, reason: 'spell synergy' },
      { enabler: 'token_generation', payoff: 'token_benefit', score: 35, reason: 'token synergy' },
      { enabler: 'mill', payoff: 'graveyard_value', score: 30, reason: 'mill-graveyard synergy' },
      { enabler: 'ramp', payoff: 'high_cost', score: 25, reason: 'ramp-payoff synergy' },
      { enabler: 'artifact_creation', payoff: 'artifact_synergy', score: 30, reason: 'artifact synergy' },
      { enabler: 'etb_effects', payoff: 'bounce_reuse', score: 25, reason: 'ETB synergy' },
      { enabler: 'card_draw', payoff: 'hand_size_matters', score: 20, reason: 'card advantage synergy' },
      { enabler: 'creature_buff', payoff: 'creature_benefit', score: 15, reason: 'creature synergy' },
      { enabler: 'flying', payoff: 'flying', score: 15, reason: 'flying synergy' },
      { enabler: 'initiative', payoff: 'monarch_effects', score: 20, reason: 'initiative synergy' }
    ];
    
    for (const pair of synergyPairs) {
      if (sourceEffects.includes(pair.enabler) && cardEffects.includes(pair.payoff)) {
        score += pair.score;
        reasons.push(pair.reason);
      }
      // Reverse relationship
      if (sourceEffects.includes(pair.payoff) && cardEffects.includes(pair.enabler)) {
        score += pair.score * 0.8; // Slightly lower for reverse
        reasons.push(`reverse ${pair.reason}`);
      }
    }
    
    // Type-based synergies
    if (sourceContext.typeLine.includes('Creature') && cardContext.typeLine.includes('Creature')) {
      // Similar mana costs work together
      if (Math.abs((sourceContext.cmc || 0) - (cardContext.cmc || 0)) <= 1) {
        score += 8;
        reasons.push('similar cost synergy');
      }
      
      // Shared creature types
      const sourceTypes = this.extractCreatureTypes(sourceContext.typeLine);
      const cardTypes = this.extractCreatureTypes(cardContext.typeLine);
      const sharedTypes = sourceTypes.filter(type => cardTypes.includes(type));
      if (sharedTypes.length > 0) {
        score += 20;
        reasons.push(`${sharedTypes[0]} tribal`);
      }
    }
    
    return Promise.resolve({
      score: Math.min(score, 100),
      reason: reasons.join(', ') || 'semantic analysis'
    });
  }

  private categorizeEffects(oracleText: string): string[] {
    const text = oracleText.toLowerCase();
    const effects: string[] = [];
    
    // Token generation
    if (text.includes('create') && text.includes('token')) {
      effects.push('token_generation');
    }
    
    // Token benefits
    if ((text.includes('sacrifice') && text.includes('token')) || 
        (text.includes('token') && (text.includes('power') || text.includes('get')))) {
      effects.push('token_benefit');
    }
    
    // Mill effects
    if (text.includes('mill') || text.includes('library') && text.includes('graveyard')) {
      effects.push('mill');
    }
    
    // Graveyard value
    if (text.includes('graveyard') || text.includes('return') && text.includes('graveyard')) {
      effects.push('graveyard_value');
    }
    
    // Ramp
    if (text.includes('add') && text.includes('mana')) {
      effects.push('ramp');
    }
    
    // High cost payoffs
    if ((oracleText.match(/\{[0-9]+\}/g) || []).some(cost => parseInt(cost.slice(1, -1)) >= 6)) {
      effects.push('high_cost');
    }
    
    // ETB effects
    if (text.includes('enters the battlefield') || text.includes('enters,')) {
      effects.push('etb_effects');
    }
    
    // Bounce/reuse
    if (text.includes('return') && text.includes('hand')) {
      effects.push('bounce_reuse');
    }
    
    // Card draw
    if (text.includes('draw')) {
      effects.push('card_draw');
    }
    
    // Hand size matters
    if (text.includes('hand size') || text.includes('cards in hand')) {
      effects.push('hand_size_matters');
    }
    
    // Flying
    if (text.includes('flying')) {
      effects.push('flying');
    }
    
    // Initiative
    if (text.includes('initiative')) {
      effects.push('initiative');
    }
    
    // Monarch effects
    if (text.includes('monarch') || text.includes('initiative')) {
      effects.push('monarch_effects');
    }
    
    // Artifact creation
    if (text.includes('artifact') && (text.includes('create') || text.includes('token'))) {
      effects.push('artifact_creation');
    }
    
    // Artifact synergy
    if (text.includes('metalcraft') || (text.includes('artifact') && text.includes('control'))) {
      effects.push('artifact_synergy');
    }
    
    // Creature buffs
    if (text.includes('+1/+1') || text.includes('power') || text.includes('toughness')) {
      effects.push('creature_buff');
    }
    
    // Creature benefits
    if (text.includes('creature') && (text.includes('get') || text.includes('gain'))) {
      effects.push('creature_benefit');
    }
    
    return effects;
  }

  private extractMechanics(oracleText: string): string[] {
    const text = oracleText.toLowerCase();
    const mechanics: string[] = [];
    
    const knownMechanics = [
      'flying', 'first strike', 'double strike', 'deathtouch', 'hexproof', 'indestructible',
      'lifelink', 'menace', 'reach', 'trample', 'vigilance', 'haste', 'flash', 'defender',
      'convoke', 'delve', 'emerge', 'prowess', 'crew', 'investigate', 'transform',
      'initiative', 'venture', 'monarch', 'mill', 'scry', 'surveil'
    ];
    
    for (const mechanic of knownMechanics) {
      if (text.includes(mechanic)) {
        mechanics.push(mechanic);
      }
    }
    
    return mechanics;
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

  private calculateBasicSynergyScore(sourceCard: Card, targetCard: Card): {score: number, reason: string} {
    let score = 0;
    const reasons: string[] = [];
    
    const sourceText = (sourceCard.oracle_text || '').toLowerCase();
    const targetText = (targetCard.oracle_text || '').toLowerCase();
    const sourceType = (sourceCard.type_line || '').toLowerCase();
    const targetType = (targetCard.type_line || '').toLowerCase();
    
    // Color synergy
    const sourceColors = sourceCard.color_identity || [];
    const targetColors = targetCard.color_identity || [];
    if (sourceColors.some(c => targetColors.includes(c))) {
      score += 0.2;
      reasons.push('shared colors');
    }
    
    // Artifact synergy
    if (sourceText.includes('artifact') && targetType.includes('artifact')) {
      score += 0.4;
      reasons.push('artifact synergy');
    }
    
    // Tribal synergy
    const tribes = ['goblin', 'elf', 'dragon', 'human', 'wizard', 'warrior'];
    for (const tribe of tribes) {
      if (sourceType.includes(tribe) && (targetType.includes(tribe) || targetText.includes(tribe))) {
        score += 0.5;
        reasons.push(`${tribe} tribal`);
        break;
      }
    }
    
    return {
      score: Math.min(score, 1.0),
      reason: reasons.join(', ') || 'basic synergy'
    };
  }

  // Find functionally similar cards (alternatives/substitutes with similar effects)
  async findFunctionallySimilarCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    try {
      // Check for stored recommendations first
      const storedSims = await db
        .select()
        .from(cardRecommendations)
        .where(and(
          eq(cardRecommendations.sourceCardId, sourceCard.id),
          eq(cardRecommendations.recommendationType, 'functional_similarity')
        ))
        .limit(20);

      if (storedSims.length > 0) {
        return storedSims.map(rec => ({
          cardId: rec.recommendedCardId,
          score: rec.score,
          reason: rec.reason || 'stored similarity'
        }));
      }

      // Generate basic similarity recommendations
      return await this.generateBasicSimilarity(sourceCard);
    } catch (error) {
      console.error('Error finding similar cards:', error);
      return [];
    }
  }

  private async generateBasicSimilarity(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
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

  private calculateBasicSimilarity(sourceCard: Card, targetCard: Card): {score: number, reason: string} {
    let score = 0;
    const reasons: string[] = [];
    
    // Type similarity
    if (sourceCard.type_line === targetCard.type_line) {
      score += 0.5;
      reasons.push('same type');
    }
    
    // Mana cost similarity  
    const cmcDiff = Math.abs((sourceCard.cmc || 0) - (targetCard.cmc || 0));
    if (cmcDiff === 0) {
      score += 0.3;
      reasons.push('same cost');
    } else if (cmcDiff === 1) {
      score += 0.15;
      reasons.push('similar cost');
    }
    
    // Power/Toughness similarity for creatures
    if (sourceCard.power && targetCard.power && sourceCard.toughness && targetCard.toughness) {
      const powerDiff = Math.abs(parseInt(sourceCard.power) - parseInt(targetCard.power));
      const toughnessDiff = Math.abs(parseInt(sourceCard.toughness) - parseInt(targetCard.toughness));
      if (powerDiff <= 1 && toughnessDiff <= 1) {
        score += 0.2;
        reasons.push('similar stats');
      }
    }
    
    // Text similarity
    const textSim = this.analyzeSimilarEffects(sourceCard.oracle_text || '', targetCard.oracle_text || '');
    score += textSim.score * 0.4;
    reasons.push(...textSim.reasons);
    
    return {
      score: Math.min(score, 1.0),
      reason: reasons.join(', ') || 'basic similarity'
    };
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