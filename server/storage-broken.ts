import { Card, SearchFilters, SearchResponse, User, InsertUser, SavedSearch, InsertSavedSearch, FavoriteCard, InsertFavoriteCard, CardCacheEntry, InsertCardCache, SearchCacheEntry, InsertSearchCache, CardRecommendation, InsertCardRecommendation, UserInteraction, InsertUserInteraction, RecommendationFeedback, InsertRecommendationFeedback } from "@shared/schema";
import { db } from "./db";
import { users, savedSearches, favoriteCards, cardCache, searchCache, cardRecommendations, userInteractions, recommendationFeedback } from "@shared/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { scryfallService } from "./services/scryfall";
import crypto from "crypto";

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
    const queryString = JSON.stringify({ filters, page });
    return crypto.createHash('md5').update(queryString).digest('hex');
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    // Try to get from cache first
    const cachedResult = await this.getCachedSearchResults(filters, page);
    if (cachedResult) {
      return cachedResult;
    }

    // Always use Scryfall for now - local search needs improvement
    const result = await scryfallService.searchCards(filters, page);
    await this.cacheSearchResults(filters, page, result);
    
    // Cache individual cards efficiently - only if not already cached
    if (result.data) {
      const cardCachePromises = result.data.map(async (card) => {
        const existingCard = await this.getCachedCard(card.id);
        if (!existingCard) {
          await this.cacheCard(card);
        }
      });
      await Promise.all(cardCachePromises);
    }

    return result;
  }

  async getCard(id: string): Promise<Card | null> {
    // Always try cache first (our complete database)
    const cachedCard = await this.getCachedCard(id);
    if (cachedCard) {
      // Update search count
      await db
        .update(cardCache)
        .set({ searchCount: sql`${cardCache.searchCount} + 1` })
        .where(eq(cardCache.id, id));
      return cachedCard;
    }

    // Only fetch from Scryfall if not in our database
    const card = await scryfallService.getCard(id);
    if (card) {
      await this.cacheCard(card);
    }
    
    return card;
  }

  async getRandomCard(): Promise<Card> {
    // Get a random cached card first to reduce API calls
    const [randomCached] = await db
      .select()
      .from(cardCache)
      .orderBy(sql`RANDOM()`)
      .limit(1);
    
    if (randomCached && Math.random() > 0.3) { // 70% chance to use cached
      return randomCached.cardData;
    }

    // Otherwise fetch from API
    const card = await scryfallService.getRandomCard();
    await this.cacheCard(card);
    return card;
  }

  // User methods
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

  // Saved searches
  async getSavedSearches(userId: number): Promise<SavedSearch[]> {
    return await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId));
  }

  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [savedSearch] = await db
      .insert(savedSearches)
      .values(search as any)
      .returning();
    return savedSearch;
  }

  async deleteSavedSearch(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(savedSearches)
      .where(eq(savedSearches.id, id) && eq(savedSearches.userId, userId));
    return (result.rowCount || 0) > 0;
  }

  // Favorite cards
  async getFavoriteCards(userId: number): Promise<FavoriteCard[]> {
    return await db
      .select()
      .from(favoriteCards)
      .where(eq(favoriteCards.userId, userId));
  }

  async addFavoriteCard(favorite: InsertFavoriteCard): Promise<FavoriteCard> {
    const [favoriteCard] = await db
      .insert(favoriteCards)
      .values(favorite as any)
      .returning();
    return favoriteCard;
  }

  async removeFavoriteCard(cardId: string, userId: number): Promise<boolean> {
    const result = await db
      .delete(favoriteCards)
      .where(eq(favoriteCards.cardId, cardId) && eq(favoriteCards.userId, userId));
    return (result.rowCount || 0) > 0;
  }

  // Cache management methods
  async cacheCard(card: Card): Promise<void> {
    try {
      console.log(`Attempting to cache card: ${card.name} (${card.id})`);
      
      // First try to insert
      try {
        await db
          .insert(cardCache)
          .values({
            id: card.id,
            cardData: card,
          });
        console.log(`Successfully cached new card: ${card.name} (${card.id})`);
      } catch (insertError: any) {
        // If duplicate key error, update instead
        if (insertError.code === '23505') { // PostgreSQL unique violation
          await db
            .update(cardCache)
            .set({
              cardData: card,
              lastUpdated: new Date(),
              searchCount: sql`${cardCache.searchCount} + 1`,
            })
            .where(eq(cardCache.id, card.id));
          console.log(`Updated existing cached card: ${card.name} (${card.id})`);
        } else {
          throw insertError;
        }
      }
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

      // Check if cache is expired
      const isExpired = Date.now() - cached.lastUpdated.getTime() > this.CACHE_TTL;
      if (isExpired) {
        // Don't delete, just fetch fresh data
        return null;
      }

      return cached.cardData;
    } catch (error) {
      console.error('Error getting cached card:', error);
      return null;
    }
  }

  async cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      console.log(`Attempting to cache search results for hash: ${queryHash}`);
      
      // First try to insert
      try {
        await db
          .insert(searchCache)
          .values({
            queryHash,
            filters,
            resultData: results,
            page,
          });
        console.log(`Successfully cached new search: ${results.data.length} cards for query hash ${queryHash}`);
      } catch (insertError: any) {
        // If duplicate key error, update instead
        if (insertError.code === '23505') { // PostgreSQL unique violation
          await db
            .update(searchCache)
            .set({
              resultData: results,
              lastAccessed: new Date(),
              accessCount: sql`${searchCache.accessCount} + 1`,
            })
            .where(eq(searchCache.queryHash, queryHash));
          console.log(`Updated existing search cache for query hash ${queryHash}`);
        } else {
          throw insertError;
        }
      }
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

      // Check if cache is expired
      const isExpired = Date.now() - cached.lastAccessed.getTime() > this.SEARCH_CACHE_TTL;
      if (isExpired) {
        return null;
      }

      // Update access time
      await db
        .update(searchCache)
        .set({ 
          lastAccessed: new Date(),
          accessCount: sql`${searchCache.accessCount} + 1`
        })
        .where(eq(searchCache.queryHash, queryHash));

      return cached.resultData;
    } catch (error) {
      console.error('Error getting cached search results:', error);
      return null;
    }
  }

  async cleanupOldCache(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      // Only clean up very old search cache to keep storage manageable
      await db
        .delete(searchCache)
        .where(sql`${searchCache.lastAccessed} < ${cutoffDate} AND ${searchCache.accessCount} < 2`);
      
      console.log('Minimal cache cleanup completed - cards preserved for recommendations');
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }

  // User interaction tracking for personalized recommendations
  async recordUserInteraction(interaction: InsertUserInteraction): Promise<void> {
    try {
      await db.insert(userInteractions).values(interaction);
    } catch (error) {
      console.error('Error recording user interaction:', error);
    }
  }

  async getUserInteractions(userId: number, limit: number = 100): Promise<UserInteraction[]> {
    return await db
      .select()
      .from(userInteractions)
      .where(eq(userInteractions.userId, userId))
      .orderBy(desc(userInteractions.createdAt))
      .limit(limit);
  }

  // Recommendation system
  async getCardRecommendations(cardId: string, type: 'synergy' | 'functional_similarity', limit: number = 10): Promise<CardRecommendation[]> {
    try {
      const recommendations = await db
        .select()
        .from(cardRecommendations)
        .where(and(
          eq(cardRecommendations.sourceCardId, cardId),
          eq(cardRecommendations.recommendationType, type)
        ))
        .orderBy(desc(cardRecommendations.score))
        .limit(limit);

      return recommendations;
    } catch (error) {
      console.error('Error getting card recommendations:', error);
      return [];
    }
  }

  async generateRecommendationsForCard(cardId: string): Promise<void> {
    try {
      // Get the source card
      const sourceCard = await this.getCachedCard(cardId);
      if (!sourceCard) return;

      // Generate both types of recommendations
      const synergyCards = await this.findSynergyCards(sourceCard);
      const functionalCards = await this.findFunctionallySimarCards(sourceCard);

      // Store synergy recommendations
      for (const rec of synergyCards) {
        try {
          await db.insert(cardRecommendations).values({
            sourceCardId: cardId,
            recommendedCardId: rec.cardId,
            recommendationType: 'synergy',
            score: rec.score,
            reason: rec.reason,
          });
        } catch (error: any) {
          if (error.code !== '23505') {
            console.error('Error storing synergy recommendation:', error);
          }
        }
      }

      // Store functional similarity recommendations
      for (const rec of functionalCards) {
        try {
          await db.insert(cardRecommendations).values({
            sourceCardId: cardId,
            recommendedCardId: rec.cardId,
            recommendationType: 'functional_similarity',
            score: rec.score,
            reason: rec.reason,
          });
        } catch (error: any) {
          if (error.code !== '23505') {
            console.error('Error storing functional recommendation:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  }

  private async findSimilarCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    const recommendations: Array<{cardId: string, score: number, reason: string}> = [];
    
    // Get all cached cards for analysis
    const allCards = await db.select().from(cardCache).limit(1000);
    
    for (const cached of allCards) {
      if (cached.id === sourceCard.id) continue;
      
      const card = cached.cardData;
      let score = 0;
      const reasons: string[] = [];

      // Mana cost similarity (high weight for same CMC)
      if (sourceCard.cmc === card.cmc) {
        score += 30;
        reasons.push('same mana value');
      } else if (Math.abs(sourceCard.cmc - card.cmc) <= 1) {
        score += 15;
        reasons.push('similar mana value');
      }

      // Color identity similarity
      const sourceColors = sourceCard.color_identity || [];
      const cardColors = card.color_identity || [];
      const colorOverlap = sourceColors.filter(c => cardColors.includes(c)).length;
      if (colorOverlap > 0) {
        score += colorOverlap * 10;
        reasons.push('shared colors');
      }

      // Type line similarity
      if (sourceCard.type_line && card.type_line) {
        const sourceTypes = sourceCard.type_line.toLowerCase().split(/[—\-\s]+/);
        const cardTypes = card.type_line.toLowerCase().split(/[—\-\s]+/);
        const typeOverlap = sourceTypes.filter(t => cardTypes.includes(t)).length;
        if (typeOverlap > 0) {
          score += typeOverlap * 15;
          reasons.push('similar card type');
        }
      }

      // Enhanced oracle text analysis (primary scoring factor)
      if (sourceCard.oracle_text && card.oracle_text) {
        const sourceText = sourceCard.oracle_text.toLowerCase();
        const cardText = card.oracle_text.toLowerCase();
        
        // Key phrase matches (high value)
        const keyPhrases = [
          'whenever', 'enters the battlefield', 'leaves the battlefield',
          'at the beginning', 'sacrifice', 'destroy', 'draw a card',
          'search your library', 'without paying', 'mana cost',
          'target player', 'target creature', 'each opponent',
          'put onto the battlefield', 'return to hand'
        ];
        
        let phraseMatches = 0;
        for (const phrase of keyPhrases) {
          if (sourceText.includes(phrase) && cardText.includes(phrase)) {
            phraseMatches++;
          }
        }
        
        if (phraseMatches > 0) {
          score += phraseMatches * 15; // High weight for phrase matches
          reasons.push('similar mechanics');
        }
        
        // Keyword abilities (medium value)
        const keywords = ['flying', 'trample', 'haste', 'vigilance', 'deathtouch', 'lifelink', 'first strike', 'double strike', 'hexproof', 'indestructible'];
        const sourceKeywords = keywords.filter(k => sourceText.includes(k));
        const cardKeywords = keywords.filter(k => cardText.includes(k));
        const keywordOverlap = sourceKeywords.filter(k => cardKeywords.includes(k)).length;
        if (keywordOverlap > 0) {
          score += keywordOverlap * 5; // Reduced weight
          reasons.push('shared abilities');
        }
      }

      // Power/Toughness similarity for creatures
      if ((sourceCard as any).power && (card as any).power && (sourceCard as any).toughness && (card as any).toughness) {
        const powerDiff = Math.abs(parseInt((sourceCard as any).power) - parseInt((card as any).power));
        const toughnessDiff = Math.abs(parseInt((sourceCard as any).toughness) - parseInt((card as any).toughness));
        if (powerDiff <= 1 && toughnessDiff <= 1) {
          score += 12;
          reasons.push('similar stats');
        }
      }

      // Set/block synergy (cards from same set often work well together)
      if (sourceCard.set === card.set) {
        score += 8;
        reasons.push('same set');
      }

      if (score >= 25) { // Minimum threshold for recommendation
        recommendations.push({
          cardId: card.id,
          score: Math.min(score, 100),
          reason: reasons.join(', ')
        });
      }
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<Card[]> {
    try {
      // Get user's recent interactions
      const interactions = await this.getUserInteractions(userId, 50);
      
      if (interactions.length === 0) {
        // New user - return popular cards
        const popularCards = await db
          .select()
          .from(cardCache)
          .orderBy(desc(cardCache.searchCount))
          .limit(limit);
        return popularCards.map(c => c.cardData);
      }

      // Get cards user has interacted with
      const userCardIds = interactions.map(i => i.cardId);
      const recommendationScores: Map<string, number> = new Map();

      // For each card the user interacted with, get recommendations
      for (const interaction of interactions.slice(0, 10)) { // Limit to recent 10
        const recommendations = await this.getCardRecommendations(interaction.cardId, 'synergy', 15);
        
        // Weight recommendations based on interaction type and recency
        const interactionWeight = this.getInteractionWeight(interaction.interactionType);
        const ageWeight = this.getAgeWeight(interaction.createdAt);
        
        for (const rec of recommendations) {
          if (userCardIds.includes(rec.recommendedCardId)) continue; // Skip cards user already knows
          
          const currentScore = recommendationScores.get(rec.recommendedCardId) || 0;
          const newScore = currentScore + (rec.score * interactionWeight * ageWeight);
          recommendationScores.set(rec.recommendedCardId, newScore);
        }
      }

      // Get top recommended cards
      const sortedRecommendations = Array.from(recommendationScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      if (sortedRecommendations.length === 0) {
        // Fallback to popular cards
        const popularCards = await db
          .select()
          .from(cardCache)
          .orderBy(desc(cardCache.searchCount))
          .limit(limit);
        return popularCards.map(c => c.cardData);
      }

      const recommendedCardIds = sortedRecommendations.map(r => r[0]);
      const cards = await db
        .select()
        .from(cardCache)
        .where(inArray(cardCache.id, recommendedCardIds));

      return cards.map(c => c.cardData);
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  private getInteractionWeight(interactionType: string): number {
    switch (interactionType) {
      case 'favorite': return 1.0;
      case 'deck_add': return 0.9;
      case 'search': return 0.6;
      case 'view': return 0.3;
      default: return 0.1;
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
    const sourceName = sourceCard.name.toLowerCase();

    for (const cached of sampleCards) {
      const card = cached.cardData;
      const cardText = (card.oracle_text || '').toLowerCase();
      const cardType = card.type_line.toLowerCase();
      let score = 0;
      const reasons: string[] = [];

      // ENABLER-PAYOFF RELATIONSHIPS (what this card enables vs what enables this card)
      
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

        for (const { pattern, weight, reason } of effectPatterns) {
          const regex = new RegExp(pattern);
          if (regex.test(sourceText) && regex.test(cardText)) {
            score += weight;
            reasons.push(reason);
          }
        }

        // Mana cost similarity for functional alternatives
        const manaDiff = Math.abs(sourceCard.cmc - card.cmc);
        if (manaDiff <= 1 && score > 0) {
          score += 10;
          reasons.push('similar cost');
        }
      }

      // Type similarity
      const sourceMainType = sourceCard.type_line.split(' ')[0];
      const cardMainType = card.type_line.split(' ')[0];
      if (sourceMainType === cardMainType && score > 0) {
        score += 15;
        reasons.push('same type');
      }

      if (score >= 20) {
        functionalCards.push({
          cardId: card.id,
          score: Math.min(score, 100),
          reason: reasons.join(', ')
        });
      }
    }

    return functionalCards.sort((a, b) => b.score - a.score).slice(0, 15);
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
