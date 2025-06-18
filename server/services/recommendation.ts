import { storage } from "../storage";
import { Card, cardThemes, InsertCardTheme, userInteractions } from "@shared/schema";
import { db } from "../db";
import { cardCache } from "@shared/schema";
import { desc, sql, eq, and, inArray, gte } from "drizzle-orm";
import { pipeline } from '@xenova/transformers';

export class RecommendationService {
  private textGenerator: any = null;
  private isInitializing = false;
  
  constructor() {
    this.initializeLocalAI();
  }

  private async initializeLocalAI() {
    if (this.isInitializing) return;
    this.isInitializing = true;
    
    try {
      console.log('Initializing local AI model...');
      // Use a lightweight text generation model that runs locally
      this.textGenerator = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
      console.log('Local AI model loaded successfully');
    } catch (error) {
      console.error('Failed to load local AI model:', error);
      console.log('Falling back to enhanced pattern matching');
    }
    this.isInitializing = false;
  }
  
  // Generate recommendations for a specific card
  async generateCardRecommendations(cardId: string): Promise<void> {
    await storage.generateRecommendationsForCard(cardId);
  }

  // Get recommendations for a card
  async getCardRecommendations(cardId: string, limit: number = 10) {
    const recommendations = await storage.getCardRecommendations(cardId, 'synergy', limit);
    
    // Get the actual card data for each recommendation
    const cardData = await Promise.all(
      recommendations.map(async (rec) => {
        const card = await storage.getCachedCard(rec.recommendedCardId);
        return {
          ...rec,
          card
        };
      })
    );

    return cardData.filter(rec => rec.card !== null);
  }

  // Get personalized recommendations based on user interactions
  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<Card[]> {
    return await storage.getPersonalizedRecommendations(userId, limit);
  }

  // Track user interaction for learning
  async trackUserInteraction(userId: number, cardId: string, interactionType: string, metadata?: any): Promise<void> {
    await storage.recordUserInteraction({
      userId,
      cardId,
      interactionType,
      metadata
    });
  }

  // Generate recommendations for popular cards in batches
  // Context-aware suggestion engine
  async getContextualSuggestions(userId: number, limit: number = 20): Promise<Card[]> {
    try {
      // Get user's recent interactions to find preferences
      const interactions = await db.select()
        .from(userInteractions)
        .where(eq(userInteractions.userId, userId))
        .orderBy(desc(userInteractions.createdAt))
        .limit(50);

      if (interactions.length === 0) {
        // Return some popular cards if no interactions
        const popularCards = await db.select()
          .from(cardCache)
          .orderBy(desc(cardCache.searchCount))
          .limit(limit);
        
        return popularCards.map(cached => cached.cardData as Card);
      }

      // Analyze interaction patterns
      const cardIds = interactions.map(i => i.cardId);
      const cards = await Promise.all(
        cardIds.map(id => storage.getCard(id))
      );
      
      const validCards = cards.filter(card => card !== null) as Card[];
      
      // Find similar cards based on interaction patterns
      const suggestions: Card[] = [];
      const usedCardIds = new Set(cardIds);
      
      for (const card of validCards.slice(0, 10)) {
        const recommendations = await storage.getCardRecommendations(card.id, 'synergy', 3);
        for (const rec of recommendations) {
          if (!usedCardIds.has(rec.recommendedCardId)) {
            const suggestedCard = await storage.getCard(rec.recommendedCardId);
            if (suggestedCard) {
              suggestions.push(suggestedCard);
              usedCardIds.add(rec.recommendedCardId);
              if (suggestions.length >= limit) break;
            }
          }
        }
        if (suggestions.length >= limit) break;
      }
      
      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Error getting contextual suggestions:', error);
      return [];
    }
  }

  private async updateUserPreferences(userId: number): Promise<void> {
    try {
      // Get recent user interactions
      const recentInteractions = await db
        .select()
        .from(userInteractions)
        .where(and(
          eq(userInteractions.userId, userId),
          gte(userInteractions.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
        ))
        .orderBy(desc(userInteractions.createdAt));

      // Analyze preferences from interactions
      const colorPreferences = new Map<string, number>();
      const archetypePreferences = new Map<string, number>();
      const typePreferences = new Map<string, number>();

      for (const interaction of recentInteractions) {
        const card = await storage.getCard(interaction.cardId);
        if (!card) continue;

        const weight = this.getInteractionWeight(interaction.interactionType);
        
        // Track color preferences
        if (card.mana_cost) {
          const colors = this.extractColors(card.mana_cost);
          for (const color of colors) {
            colorPreferences.set(color, (colorPreferences.get(color) || 0) + weight);
          }
        }

        // Track type preferences
        const mainType = card.type_line.split(' ')[0];
        typePreferences.set(mainType, (typePreferences.get(mainType) || 0) + weight);

        // Track archetype preferences based on card characteristics
        const archetypes = this.inferArchetypesFromCard(card);
        for (const archetype of archetypes) {
          archetypePreferences.set(archetype, (archetypePreferences.get(archetype) || 0) + weight * 0.5);
        }
      }

      // Update preferences in database
      await this.saveUserPreferences(userId, 'color', colorPreferences);
      await this.saveUserPreferences(userId, 'archetype', archetypePreferences);
      await this.saveUserPreferences(userId, 'card_type', typePreferences);

    } catch (error) {
      console.error('Error updating user preferences:', error);
    }
  }

  private async saveUserPreferences(userId: number, type: string, preferences: Map<string, number>): Promise<void> {
    // Normalize preferences to 0-1 scale
    const maxScore = Math.max(...Array.from(preferences.values()));
    if (maxScore === 0) return;

    for (const entry of preferences.entries()) {
      const [value, score] = entry;
      const normalizedScore = score / maxScore;
      
      // Only save significant preferences
      if (normalizedScore < 0.1) continue;

      try {
        await db.insert(userPreferences).values({
          userId,
          preferenceType: type,
          preferenceValue: value,
          weight: normalizedScore
        }).onConflictDoUpdate({
          target: [userPreferences.userId, userPreferences.preferenceType, userPreferences.preferenceValue],
          set: {
            weight: sql`GREATEST(${userPreferences.weight}, ${normalizedScore})`,
            lastUpdated: new Date()
          }
        });
      } catch (error) {
        console.error('Error saving preference:', error);
      }
    }
  }

  private async generateContextualSuggestions(userId: number): Promise<void> {
    try {
      // Clear old suggestions
      await db.delete(adaptiveRecommendations)
        .where(eq(adaptiveRecommendations.userId, userId));

      // Get user preferences
      const preferences = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId));

      // Get cards user has already interacted with
      const interactedCards = await db
        .select({ cardId: userInteractions.cardId })
        .from(userInteractions)
        .where(eq(userInteractions.userId, userId));
      
      const knownCardIds = new Set(interactedCards.map(i => i.cardId));

      // Generate suggestions based on preferences
      const suggestions: any[] = [];

      // Get sample of cards to score
      const candidateCards = await db
        .select()
        .from(cardCache)
        .orderBy(desc(cardCache.searchCount))
        .limit(500);

      for (const cached of candidateCards) {
        const card = cached.cardData as Card;
        
        // Skip cards user already knows
        if (knownCardIds.has(card.id)) continue;

        let score = 0;
        const reasons: string[] = [];

        // Score based on color preferences
        const colorPrefs = preferences.filter(p => p.preferenceType === 'color');
        if (card.mana_cost) {
          const cardColors = this.extractColors(card.mana_cost);
          for (const color of cardColors) {
            const pref = colorPrefs.find(p => p.preferenceValue === color);
            if (pref) {
              score += pref.weight * 0.3;
              reasons.push(`matches ${color} preference`);
            }
          }
        }

        // Score based on type preferences
        const typePrefs = preferences.filter(p => p.preferenceType === 'card_type');
        const mainType = card.type_line.split(' ')[0];
        const typePref = typePrefs.find(p => p.preferenceValue === mainType);
        if (typePref) {
          score += typePref.weight * 0.4;
          reasons.push(`matches ${mainType} preference`);
        }

        // Score based on archetype preferences
        const archetypePrefs = preferences.filter(p => p.preferenceType === 'archetype');
        const cardArchetypes = this.inferArchetypesFromCard(card);
        for (const archetype of cardArchetypes) {
          const pref = archetypePrefs.find(p => p.preferenceValue === archetype);
          if (pref) {
            score += pref.weight * 0.3;
            reasons.push(`fits ${archetype} archetype`);
          }
        }

        if (score > 0.2) {
          suggestions.push({
            userId,
            cardId: 'contextual', // Placeholder for contextual suggestions
            recommendedCardId: card.id,
            contextType: 'preference_match',
            contextData: { preferences: preferences.map(p => p.preferenceType) },
            score,
            reason: reasons.join(', '),
            adaptationFactors: { userPreferences: true }
          });
        }
      }

      // Save top suggestions
      if (suggestions.length > 0) {
        const topSuggestions = suggestions
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);

        await db.insert(adaptiveRecommendations).values(topSuggestions);
      }

    } catch (error) {
      console.error('Error generating contextual suggestions:', error);
    }
  }

  private inferArchetypesFromCard(card: Card): string[] {
    const archetypes: string[] = [];
    const text = (card.oracle_text || '').toLowerCase();
    const type = card.type_line.toLowerCase();

    if (text.includes('artifact') || type.includes('artifact')) archetypes.push('artifacts');
    if (text.includes('graveyard') || text.includes('dies')) archetypes.push('graveyard');
    if (text.includes('token')) archetypes.push('tokens');
    if (text.includes('counter') || text.includes('+1/+1')) archetypes.push('counters');
    if (text.includes('prowess') || text.includes('spell')) archetypes.push('spells');
    if (type.includes('creature') && card.cmc <= 3) archetypes.push('aggro');
    if (text.includes('draw') || text.includes('counter target')) archetypes.push('control');

    return archetypes;
  }

  private extractColors(manaCost: string): string[] {
    const colors: string[] = [];
    if (manaCost.includes('W')) colors.push('white');
    if (manaCost.includes('U')) colors.push('blue');
    if (manaCost.includes('B')) colors.push('black');
    if (manaCost.includes('R')) colors.push('red');
    if (manaCost.includes('G')) colors.push('green');
    return colors;
  }

  private getInteractionWeight(interactionType: string): number {
    switch (interactionType) {
      case 'deck_add': return 1.0;
      case 'favorite': return 0.9;
      case 'recommendation_click': return 0.7;
      case 'view': return 0.3;
      case 'search': return 0.2;
      default: return 0.1;
    }
  }

  async generateRecommendationsForPopularCards(limit: number = 50): Promise<void> {
    console.log('Generating recommendations for popular cards...');
    
    // Get popular cards based on search frequency
    const popularCards = await db.execute(sql`
      SELECT id FROM card_cache 
      ORDER BY search_count DESC 
      LIMIT ${limit}
    `);

    const rows = (popularCards as any).rows || [];
    for (const cardResult of rows) {
      try {
        console.log(`Generating recommendations for popular card: ${cardResult.id}`);
        await this.generateCardRecommendations(cardResult.id);
      } catch (error) {
        console.error(`Error generating recommendations for card ${cardResult.id}:`, error);
      }
    }
    
    console.log('Finished generating recommendations for popular cards');
  }

  async getThemeSuggestions(cardId: string): Promise<Array<{theme: string, description: string, cards: Card[]}>> {
    try {
      console.log(`Getting theme suggestions for card: ${cardId}`);
      
      // Use storage.getCard for consistent data handling
      const card = await storage.getCard(cardId);
      
      if (!card) {
        console.error(`Card not found for ID: ${cardId}`);
        return [];
      }

      console.log(`Retrieved card: ${card.name} (${card.type_line})`);

      // Generate themes using local AI analysis
      const detectedThemes = await this.analyzeCardWithLocalAI(card);
      console.log(`Found ${detectedThemes.length} themes for ${card.name}:`, detectedThemes.map(t => t.name));
      
      const results: Array<{theme: string, description: string, cards: Card[]}> = [];

      // For each detected theme, find matching cards
      for (const theme of detectedThemes) {
        try {
          const relatedCards = await this.findCardsForDynamicTheme(theme, card);
          console.log(`Theme "${theme.name}" found ${relatedCards.length} cards`);
          if (relatedCards.length > 0) {
            results.push({
              theme: theme.name,
              description: theme.description,
              cards: relatedCards.slice(0, 12)
            });
          }
        } catch (error) {
          console.error(`Error finding cards for theme "${theme.name}":`, error);
        }
      }

      return results.slice(0, 6);
    } catch (error) {
      console.error('Error getting theme suggestions:', error);
      return [];
    }
  }

  private async analyzeCardWithLocalAI(card: Card): Promise<Array<{name: string, description: string, keywords: string[], searchTerms: string[]}>> {
    // Validate card data
    if (!card || !card.name) {
      console.error('Invalid card data:', card);
      return [];
    }

    // Use intelligent pattern matching for reliable theme detection
    return this.analyzeCardIntelligently(card);
  }

  private async generateThemesWithAI(card: Card): Promise<Array<{name: string, description: string, keywords: string[], searchTerms: string[]}>> {
    if (!card?.name) {
      console.error('Cannot generate themes for card without name:', card);
      return [];
    }

    const prompt = `Analyze Magic card "${card.name}" (${card.type_line || 'Unknown type'}): ${card.oracle_text || 'No text'}. List strategic deck themes: Control, Aggro, Combo, Prison, Theft, Tokens, Reanimator, Artifacts, Tribal, Stax.`;
    
    try {
      console.log(`Generating AI themes for "${card.name}"...`);
      const result = await this.textGenerator(prompt, {
        max_length: 120,
        temperature: 0.7,
        do_sample: false,
      });
      
      const aiText = result[0]?.generated_text || '';
      console.log(`AI response: "${aiText.substring(0, 80)}..."`);
      
      if (!aiText || aiText.length < 5) {
        console.log('AI response too short, using fallback');
        return [];
      }
      
      const parsedThemes = this.parseAIThemes(aiText, card);
      console.log(`Extracted ${parsedThemes.length} themes`);
      return parsedThemes;
    } catch (error) {
      console.error('AI theme generation failed:', error);
      return [];
    }
  }

  private parseAIThemes(aiText: string, card: Card): Array<{name: string, description: string, keywords: string[], searchTerms: string[]}> {
    const themes = [];
    const text = aiText.toLowerCase();
    
    console.log(`Parsing AI text: "${text}"`);
    
    // Extract common strategic themes from AI response
    const themePatterns = {
      'Theft & Control Magic': {
        keywords: ['theft', 'steal', 'control', 'gain control', 'take control'],
        searchTerms: ['gain control', 'take control', 'steal', 'threaten', 'confiscate']
      },
      'Stax & Prison': {
        keywords: ['stax', 'prison', 'tax', 'restriction', 'lock', 'sphere', 'orb'],
        searchTerms: ['additional cost', 'can\'t attack', 'can\'t activate', 'costs more']
      },
      'Token Strategies': {
        keywords: ['token', 'create', 'generate', 'swarm', 'populate'],
        searchTerms: ['create token', 'token creature', 'populate', 'convoke']
      },
      'Reanimator': {
        keywords: ['reanimate', 'graveyard', 'return', 'resurrect', 'unearth'],
        searchTerms: ['return from graveyard', 'return target creature', 'reanimate']
      },
      'Combo Enabler': {
        keywords: ['combo', 'infinite', 'engine', 'catalyst', 'storm'],
        searchTerms: ['infinite', 'untap all', 'storm', 'cascade']
      },
      'Artifact Synergy': {
        keywords: ['artifact', 'equipment', 'construct', 'metalcraft'],
        searchTerms: ['artifact', 'equipment', 'metalcraft', 'affinity']
      },
      'Aristocrats': {
        keywords: ['sacrifice', 'dies', 'death', 'aristocrat', 'blood'],
        searchTerms: ['sacrifice', 'when dies', 'whenever dies', 'death trigger']
      }
    };

    // Also check the card's own text for direct theme matches
    const cardText = `${card.name} ${card.oracle_text || ''}`.toLowerCase();
    
    for (const [themeName, themeData] of Object.entries(themePatterns)) {
      const matchesAI = themeData.keywords.some(keyword => text.includes(keyword));
      const matchesCard = themeData.keywords.some(keyword => cardText.includes(keyword));
      
      if (matchesAI || matchesCard) {
        console.log(`Matched theme: ${themeName} (AI: ${matchesAI}, Card: ${matchesCard})`);
        themes.push({
          name: themeName,
          description: `${themeName} strategies that work with ${card.name}`,
          keywords: themeData.keywords,
          searchTerms: themeData.searchTerms
        });
      }
    }

    console.log(`Extracted ${themes.length} themes: ${themes.map(t => t.name).join(', ')}`);
    return themes.slice(0, 4);
  }

  private analyzeCardIntelligently(card: Card): Array<{name: string, description: string, keywords: string[], searchTerms: string[]}> {
    const themes = [];
    const cardName = (card.name || '').toLowerCase();
    const oracleText = (card.oracle_text || '').toLowerCase();
    const typeLine = (card.type_line || '').toLowerCase();
    const manaCost = card.mana_cost || '';

    // EQUIPMENT VOLTRON - Focused on single creature power
    if (this.matchesTheme(cardName, oracleText, [
      'equipment', 'attach', 'equipped creature gets', 'equip', 'aura', 'enchant creature',
      'target creature gets', 'hexproof', 'protection', 'unblockable', 'flying'
    ]) || typeLine.includes('equipment') || typeLine.includes('aura')) {
      themes.push({
        name: 'Voltron Equipment',
        description: 'Build up one powerful creature with equipment and auras',
        keywords: ['equipment', 'aura', 'equip', 'attach', 'hexproof', 'protection'],
        searchTerms: ['equipment', 'aura', 'enchant creature', 'equipped creature gets', 'target creature gets']
      });
    }

    // ARISTOCRATS - Death triggers and sacrifice
    if (this.matchesTheme(cardName, oracleText, [
      'sacrifice', 'when.*dies', 'whenever.*dies', 'death trigger', 'blood artist',
      'aristocrat', 'sac outlet', 'zulaport cutthroat', 'grave pact'
    ])) {
      themes.push({
        name: 'Aristocrats',
        description: 'Sacrifice creatures for value and death triggers',
        keywords: ['sacrifice', 'dies', 'death trigger', 'blood artist', 'zulaport'],
        searchTerms: ['when.*dies', 'whenever.*dies', 'sacrifice.*creature', 'blood artist', 'zulaport cutthroat']
      });
    }

    // TOKEN GENERATION - Create creature tokens
    if (this.matchesTheme(cardName, oracleText, [
      'create.*token', 'token creature', 'populate', 'convoke', 'go wide',
      'creature token', 'enters.*token', 'army of the damned'
    ])) {
      themes.push({
        name: 'Token Generation',
        description: 'Create and benefit from creature tokens',
        keywords: ['token', 'create', 'populate', 'convoke', 'go wide'],
        searchTerms: ['create.*token', 'token creature', 'populate', 'convoke']
      });
    }

    // GRAVEYARD VALUE - Recursion and graveyard interaction
    if (this.matchesTheme(cardName, oracleText, [
      'graveyard', 'return.*from.*graveyard', 'mill', 'dredge', 'flashback',
      'unearth', 'reanimate', 'living death', 'regrowth', 'eternal witness'
    ])) {
      themes.push({
        name: 'Graveyard Value',
        description: 'Use the graveyard as a resource for card advantage',
        keywords: ['graveyard', 'return', 'mill', 'dredge', 'flashback', 'reanimate'],
        searchTerms: ['return.*from.*graveyard', 'mill', 'dredge', 'flashback', 'unearth']
      });
    }

    // ARTIFACT SYNERGY - Artifact-based strategies
    if (this.matchesTheme(cardName, oracleText, [
      'artifact', 'metalcraft', 'affinity', 'improvise', 'fabricate',
      'tinker', 'welder', 'modular', 'artifacts matter'
    ]) || typeLine.includes('artifact')) {
      themes.push({
        name: 'Artifact Synergy',
        description: 'Leverage artifacts for powerful synergies',
        keywords: ['artifact', 'metalcraft', 'affinity', 'improvise', 'fabricate'],
        searchTerms: ['artifact', 'metalcraft', 'affinity', 'improvise', 'fabricate']
      });
    }

    // AGGRO & BURN - Enhanced detection  
    if (this.matchesTheme(cardName, oracleText, [
      'haste', 'trample', 'first strike', 'damage to any target', 'direct damage',
      'lightning bolt', 'burn', 'aggressive', 'attack', 'combat damage'
    ])) {
      themes.push({
        name: 'Aggro & Burn',
        description: 'Fast aggressive strategies and direct damage',
        keywords: ['haste', 'trample', 'damage', 'burn', 'aggressive'],
        searchTerms: ['haste', 'trample', 'damage to any target', 'first strike']
      });
    }

    // STAX & PRISON - Enhanced detection
    if (this.matchesTheme(cardName, oracleText, [
      'winter orb', 'static orb', 'tangle wire', 'smokestack', 'trinisphere',
      'sphere of resistance', 'thorn of amethyst', 'thalia', 'vryn wingmare',
      'can\'t attack', 'can\'t block', 'can\'t activate', 'can\'t untap',
      'additional cost', 'costs more', 'tax'
    ])) {
      themes.push({
        name: 'Stax & Prison',
        description: 'Resource denial and restricting opponent actions',
        keywords: ['tax', 'additional cost', 'can\'t', 'sphere', 'orb'],
        searchTerms: ['additional cost', 'can\'t attack', 'can\'t activate', 'costs more', 'tax']
      });
    }

    // ARISTOCRATS & SACRIFICE - Enhanced detection
    if (this.matchesTheme(cardName, oracleText, [
      'blood artist', 'zulaport cutthroat', 'falkenrath aristocrat', 'viscera seer',
      'sacrifice', 'when dies', 'whenever dies', 'death trigger', 'aristocrats',
      'each opponent loses life', 'whenever a creature dies'
    ])) {
      themes.push({
        name: 'Aristocrats & Sacrifice',
        description: 'Converting creature deaths into value and damage',
        keywords: ['sacrifice', 'dies', 'death', 'aristocrat', 'blood'],
        searchTerms: ['sacrifice', 'when dies', 'whenever dies', 'death trigger', 'loses life']
      });
    }

    // REANIMATOR - Enhanced detection
    if (this.matchesTheme(cardName, oracleText, [
      'reanimate', 'animate dead', 'necromancy', 'exhume', 'living death',
      'return from graveyard', 'return target creature', 'unearth', 'persist',
      'undying', 'flashback', 'disturb'
    ])) {
      themes.push({
        name: 'Reanimator',
        description: 'Cheating expensive creatures from graveyard to battlefield',
        keywords: ['reanimate', 'return', 'graveyard', 'unearth', 'persist'],
        searchTerms: ['return from graveyard', 'return target creature', 'reanimate', 'unearth']
      });
    }

    // COMBO ENABLER - Enhanced detection
    if (this.matchesTheme(cardName, oracleText, [
      'infinite', 'untap all', 'storm', 'cascade', 'flash', 'show and tell',
      'sneak attack', 'enter the infinite', 'dramatic reversal', 'isochron scepter',
      'paradox engine', 'kiki-jiki', 'splinter twin', 'deceiver exarch'
    ])) {
      themes.push({
        name: 'Combo Enabler',
        description: 'Cards that enable infinite combos or explosive turns',
        keywords: ['infinite', 'untap', 'storm', 'flash', 'cascade'],
        searchTerms: ['infinite', 'untap all', 'storm', 'cascade', 'flash']
      });
    }

    // Continue with other enhanced theme detections...
    this.addAdditionalThemes(themes, cardName, oracleText, typeLine, manaCost);

    return themes.slice(0, 5); // Return top 5 themes
  }

  private matchesTheme(cardName: string, oracleText: string, patterns: string[]): boolean {
    const searchText = `${cardName} ${oracleText}`.toLowerCase();
    return patterns.some(pattern => searchText.includes(pattern.toLowerCase()));
  }

  private addAdditionalThemes(themes: any[], cardName: string, oracleText: string, typeLine: string, manaCost: string): void {
    // TOKEN STRATEGIES
    if (this.matchesTheme(cardName, oracleText, [
      'token', 'create', 'populate', 'convoke', 'go wide', 'doubling season'
    ])) {
      themes.push({
        name: 'Token Strategies',
        description: 'Creating and leveraging creature tokens',
        keywords: ['token', 'create', 'populate', 'convoke'],
        searchTerms: ['create token', 'token creature', 'populate']
      });
    }

    // VOLTRON EQUIPMENT
    if (this.matchesTheme(cardName, oracleText, [
      'equipment', 'attach', 'equipped creature', 'aura', 'enchant creature',
      'voltron', 'sword of', 'jitte', 'batterskull'
    ])) {
      themes.push({
        name: 'Voltron Equipment',
        description: 'Building up one powerful creature with equipment/auras',
        keywords: ['equipment', 'aura', 'attach', 'enchant'],
        searchTerms: ['equipment', 'attach', 'enchant creature', 'equipped creature']
      });
    }

    // STORM COMBO
    if (this.matchesTheme(cardName, oracleText, [
      'storm', 'ritual', 'mana', 'add mana', 'fast mana', 'tendrils of agony'
    ])) {
      themes.push({
        name: 'Storm Combo',
        description: 'Chaining spells for explosive storm finishes',
        keywords: ['storm', 'ritual', 'mana', 'chain'],
        searchTerms: ['storm', 'add mana', 'ritual', 'fast mana']
      });
    }
  }

  private getFallbackThemes(card: Card): Array<{name: string, description: string, keywords: string[], searchTerms: string[]}> {
    const themes = [];
    const cardName = (card.name || '').toLowerCase();
    const cardText = `${card.name || ''} ${card.oracle_text || ''} ${card.type_line || ''}`.toLowerCase();
    const oracleText = (card.oracle_text || '').toLowerCase();
    const typeLine = (card.type_line || '').toLowerCase();
    
    // THEFT & CONTROL MAGIC
    if (cardName.includes('abduction') || cardName.includes('steal') || cardName.includes('mind control') ||
        oracleText.includes('gain control') || oracleText.includes('take control') || 
        oracleText.includes('steal') || oracleText.includes('exchange control')) {
      themes.push({
        name: 'Theft & Control Magic',
        description: 'Taking control of opponent permanents and resources',
        keywords: ['steal', 'control', 'gain control', 'exchange'],
        searchTerms: ['gain control', 'take control', 'steal', 'exchange control', 'control target']
      });
    }

    // STAX & PRISON
    if (oracleText.match(/can't\s+(attack|block|be\s+activated|untap)/) ||
        oracleText.includes('tax') || oracleText.includes('additional cost') ||
        oracleText.includes('pay') && oracleText.includes('more')) {
      themes.push({
        name: 'Stax & Prison',
        description: 'Disrupting opponent resources and restricting actions',
        keywords: ['tax', 'restriction', 'additional cost', 'can\'t'],
        searchTerms: ['additional cost', 'can\'t attack', 'can\'t block', 'tax', 'pay more']
      });
    }

    // TOKEN GENERATION
    if (oracleText.includes('token') || 
        (oracleText.includes('create') && oracleText.includes('creature'))) {
      themes.push({
        name: 'Token Generation',
        description: 'Creating and utilizing creature tokens for board presence',
        keywords: ['token', 'create', 'creature'],
        searchTerms: ['create token', 'token creature', 'creature token']
      });
    }

    // GRAVEYARD VALUE
    if (oracleText.includes('graveyard') || 
        (oracleText.includes('return') && oracleText.includes('battlefield')) ||
        oracleText.includes('mill') || oracleText.includes('dredge')) {
      themes.push({
        name: 'Graveyard Value',
        description: 'Using the graveyard as a resource for card advantage',
        keywords: ['graveyard', 'return', 'mill', 'dredge'],
        searchTerms: ['graveyard', 'return from graveyard', 'mill', 'put into graveyard']
      });
    }

    // ARTIFACT SYNERGY
    if (typeLine.includes('artifact') || oracleText.includes('artifact')) {
      themes.push({
        name: 'Artifact Synergy',
        description: 'Strategies built around artifact interactions',
        keywords: ['artifact', 'equipment', 'construct'],
        searchTerms: ['artifact', 'equipment', 'artifact creature']
      });
    }

    // SACRIFICE VALUE
    if (oracleText.includes('sacrifice') || 
        (oracleText.includes('destroy') && oracleText.includes('you control'))) {
      themes.push({
        name: 'Sacrifice Value',
        description: 'Converting permanents into value through sacrifice',
        keywords: ['sacrifice', 'destroy', 'death'],
        searchTerms: ['sacrifice', 'when dies', 'death trigger']
      });
    }

    // COUNTER MAGIC
    if (oracleText.includes('counter') && oracleText.includes('spell')) {
      themes.push({
        name: 'Counter Magic',
        description: 'Control strategy focused on countering opponent spells',
        keywords: ['counter', 'spell', 'permission'],
        searchTerms: ['counter target spell', 'counter spell']
      });
    }

    // BURN & DIRECT DAMAGE
    if (oracleText.includes('damage') && 
        (oracleText.includes('player') || oracleText.includes('opponent') || oracleText.includes('any target'))) {
      themes.push({
        name: 'Burn & Direct Damage',
        description: 'Dealing direct damage to opponents and planeswalkers',
        keywords: ['damage', 'burn', 'direct'],
        searchTerms: ['damage to any target', 'damage to opponent', 'deals damage']
      });
    }

    // LIFEGAIN
    if (oracleText.includes('gain') && oracleText.includes('life')) {
      themes.push({
        name: 'Lifegain Strategy',
        description: 'Gaining life and leveraging lifegain triggers',
        keywords: ['lifegain', 'gain life', 'life'],
        searchTerms: ['gain life', 'whenever you gain life', 'lifegain']
      });
    }

    // MILL STRATEGY
    if (oracleText.includes('mill') || 
        (oracleText.includes('library') && oracleText.includes('graveyard'))) {
      themes.push({
        name: 'Mill Strategy',
        description: 'Depleting opponent library or self-mill for value',
        keywords: ['mill', 'library', 'graveyard'],
        searchTerms: ['mill', 'library into graveyard', 'put cards from library']
      });
    }

    // +1/+1 COUNTERS
    if (oracleText.includes('+1/+1 counter') || 
        (oracleText.includes('counter') && oracleText.includes('creature'))) {
      themes.push({
        name: '+1/+1 Counters',
        description: 'Growing creatures with +1/+1 counters',
        keywords: ['counter', 'grow', '+1/+1'],
        searchTerms: ['+1/+1 counter', 'counter on creature', 'put counter']
      });
    }

    // RAMP & MANA ACCELERATION
    if (oracleText.includes('mana') || 
        (oracleText.includes('land') && oracleText.includes('search'))) {
      themes.push({
        name: 'Ramp & Acceleration',
        description: 'Accelerating mana development for big plays',
        keywords: ['ramp', 'mana', 'land'],
        searchTerms: ['search for land', 'add mana', 'mana acceleration']
      });
    }

    // TRIBAL THEMES
    const tribalTypes = ['elf', 'goblin', 'zombie', 'human', 'dragon', 'angel', 'demon', 'spirit', 'vampire', 'wizard', 'warrior', 'knight', 'beast', 'cat', 'bird'];
    for (const tribe of tribalTypes) {
      if (typeLine.includes(tribe) || oracleText.includes(tribe)) {
        themes.push({
          name: `${tribe.charAt(0).toUpperCase() + tribe.slice(1)} Tribal`,
          description: `Tribal strategy focused on ${tribe} creatures and synergies`,
          keywords: [tribe, 'tribal', 'creature type'],
          searchTerms: [`${tribe}`, `${tribe} creature`, `other ${tribe}s`]
        });
      }
    }

    // ENCHANTMENT SYNERGY
    if (typeLine.includes('enchantment') || oracleText.includes('enchantment')) {
      themes.push({
        name: 'Enchantment Synergy',
        description: 'Strategies built around enchantment interactions',
        keywords: ['enchantment', 'aura', 'constellation'],
        searchTerms: ['enchantment', 'constellation', 'enchant']
      });
    }

    // CARD DRAW & ADVANTAGE
    if (oracleText.includes('draw') && oracleText.includes('card')) {
      themes.push({
        name: 'Card Draw & Advantage',
        description: 'Generating card advantage through draw effects',
        keywords: ['draw', 'card', 'advantage'],
        searchTerms: ['draw card', 'draw cards', 'card advantage']
      });
    }

    return themes.slice(0, 8); // Return up to 8 most relevant themes
  }

  private async findCardsForDynamicTheme(theme: {name: string, description: string, keywords: string[], searchTerms: string[]}, sourceCard: Card): Promise<Card[]> {
    console.log(`Searching for cards for theme: ${theme.name}`);
    
    try {
      const matchingCards: Array<{card: Card, score: number}> = [];

      // Get a broader sample of cards to search through
      const candidateCards = await db
        .select()
        .from(cardCache)
        .limit(5000); // Increased sample size

      console.log(`Analyzing ${candidateCards.length} candidate cards for theme: ${theme.name}`);
      for (const cached of candidateCards) {
        const card = cached.cardData as Card;
        
        // Skip the source card itself
        if (card.id === sourceCard.id) continue;

        const relevanceScore = this.calculateThemeRelevance(card, theme);
        
        if (relevanceScore > 0.2) { // Reasonable threshold for quality results
          matchingCards.push({ card, score: relevanceScore });
        }
      }

      // Sort by relevance and take top results
      const sortedCards = matchingCards
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);

      console.log(`Theme "${theme.name}" found ${sortedCards.length} cards`);
      
      // Remove duplicates by card ID
      const uniqueCards = new Map<string, {card: Card, score: number}>();
      for (const item of sortedCards) {
        if (!uniqueCards.has(item.card.id)) {
          uniqueCards.set(item.card.id, item);
        }
      }

      return Array.from(uniqueCards.values()).map(item => item.card);
    } catch (error) {
      console.error(`Error finding cards for theme ${theme.name}:`, error);
      return [];
    }
  }

  private calculateThemeRelevance(card: any, theme: {name: string, keywords: string[], searchTerms: string[]}): number {
    const cardName = (card.name || '').toLowerCase();
    const oracleText = (card.oracle_text || '').toLowerCase();
    const typeLine = (card.type_line || '').toLowerCase();
    
    let score = 0;
    
    // Special handling for Graveyard Value theme
    if (theme.name === 'Graveyard Value') {
      // Look for cycling cards
      if (oracleText.includes('cycling')) score += 0.8;
      if (oracleText.includes('cycle')) score += 0.6;
      
      // Look for graveyard interaction
      if (oracleText.includes('graveyard')) score += 0.7;
      if (oracleText.includes('from your graveyard')) score += 0.9;
      if (oracleText.includes('return') && oracleText.includes('graveyard')) score += 0.8;
      
      // Look for discard synergies
      if (oracleText.includes('discard')) score += 0.5;
      if (oracleText.includes('madness')) score += 0.7;
      
      // Look for cards that care about being in graveyard
      if (oracleText.includes('from the graveyard')) score += 0.6;
      if (oracleText.includes('flashback')) score += 0.7;
      if (oracleText.includes('unearth')) score += 0.7;
      if (oracleText.includes('dredge')) score += 0.8;
    }
    
    // Check for keyword matches
    for (const keyword of theme.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (cardName.includes(keywordLower)) score += 0.4;
      if (oracleText.includes(keywordLower)) score += 0.3;
      if (typeLine.includes(keywordLower)) score += 0.2;
    }
    
    // Check for search term matches
    for (const searchTerm of theme.searchTerms) {
      const termLower = searchTerm.toLowerCase();
      if (cardName.includes(termLower)) score += 0.3;
      if (oracleText.includes(termLower)) score += 0.2;
    }
    
    return Math.min(score, 1.0); // Cap at 1.0
  }

  async analyzeAndStoreCardThemes(card: Card): Promise<any[]> {
    const themes = await this.analyzeCardWithLocalAI(card);
    const storedThemes = [];

    for (const theme of themes) {
      try {
        const [insertedTheme] = await db.insert(cardThemes).values({
          cardId: card.id,
          themeName: theme.name,
          description: theme.description,
          keywords: theme.keywords,
          themeCategory: 'strategic',
          confidence: 85
        }).returning();
        
        storedThemes.push(insertedTheme);
      } catch (error) {
        console.error('Error storing theme:', error);
      }
    }

    return storedThemes;
  }

  private async findCardsForStoredTheme(theme: any, sourceCard: Card): Promise<Card[]> {
    const dynamicTheme = {
      name: theme.themeName,
      description: theme.description || '',
      keywords: theme.keywords || [],
      searchTerms: theme.keywords || []
    };
    
    return this.findCardsForDynamicTheme(dynamicTheme, sourceCard);
  }
}

export const recommendationService = new RecommendationService();