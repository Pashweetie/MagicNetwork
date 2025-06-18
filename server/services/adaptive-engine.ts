import { db } from "../db";
import { userInteractions, userPreferences, adaptiveRecommendations, cardCache } from "@shared/schema";
import { desc, sql, eq, and, gte } from "drizzle-orm";
import type { Card, InsertUserPreference, InsertAdaptiveRecommendation } from "@shared/schema";

export class AdaptiveRecommendationEngine {
  
  // Learn user preferences from their interactions
  async learnFromUserInteractions(userId: number): Promise<void> {
    try {
      // Get recent interactions (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const interactions = await db.select()
        .from(userInteractions)
        .where(and(
          eq(userInteractions.userId, userId),
          gte(userInteractions.createdAt, thirtyDaysAgo)
        ))
        .orderBy(desc(userInteractions.createdAt));

      // Analyze interaction patterns
      const patterns = this.analyzeInteractionPatterns(interactions);
      
      // Update user preferences based on patterns
      await this.updateUserPreferences(userId, patterns);
      
      console.log(`Updated preferences for user ${userId} based on ${interactions.length} interactions`);
    } catch (error) {
      console.error('Error learning from user interactions:', error);
    }
  }
  
  private analyzeInteractionPatterns(interactions: any[]): Map<string, { weight: number, evidence: number }> {
    const patterns = new Map<string, { weight: number, evidence: number }>();
    
    for (const interaction of interactions) {
      const weight = this.getInteractionWeight(interaction.interactionType);
      
      // Extract card information from metadata if available
      if (interaction.metadata) {
        const cardData = interaction.metadata.cardData;
        if (cardData) {
          // Color preferences
          if (cardData.colors) {
            for (const color of cardData.colors) {
              this.addPattern(patterns, `color_${color}`, weight);
            }
          }
          
          // Type preferences
          if (cardData.type_line) {
            const mainType = cardData.type_line.split(' ')[0];
            this.addPattern(patterns, `type_${mainType.toLowerCase()}`, weight);
          }
          
          // CMC preferences
          if (cardData.cmc !== undefined) {
            const cmcRange = this.getCMCRange(cardData.cmc);
            this.addPattern(patterns, `cmc_${cmcRange}`, weight);
          }
          
          // Archetype detection from oracle text
          if (cardData.oracle_text) {
            const archetypes = this.detectArchetypes(cardData.oracle_text);
            for (const archetype of archetypes) {
              this.addPattern(patterns, `archetype_${archetype}`, weight);
            }
          }
        }
      }
    }
    
    return patterns;
  }
  
  private addPattern(patterns: Map<string, { weight: number, evidence: number }>, key: string, weight: number): void {
    const existing = patterns.get(key) || { weight: 0, evidence: 0 };
    patterns.set(key, {
      weight: existing.weight + weight,
      evidence: existing.evidence + 1
    });
  }
  
  private getInteractionWeight(interactionType: string): number {
    switch (interactionType) {
      case 'favorite': return 3.0;
      case 'deck_add': return 2.5;
      case 'view_recommendations': return 1.5;
      case 'search': return 1.0;
      case 'view': return 0.5;
      default: return 0.1;
    }
  }
  
  private getCMCRange(cmc: number): string {
    if (cmc <= 1) return 'low';
    if (cmc <= 3) return 'mid';
    if (cmc <= 5) return 'high';
    return 'very_high';
  }
  
  private detectArchetypes(oracleText: string): string[] {
    const text = oracleText.toLowerCase();
    const archetypes = [];
    
    if (text.includes('counter') || text.includes('spell') || text.includes('instant')) {
      archetypes.push('control');
    }
    if (text.includes('token') || text.includes('create')) {
      archetypes.push('token');
    }
    if (text.includes('graveyard') || text.includes('dies') || text.includes('sacrifice')) {
      archetypes.push('graveyard');
    }
    if (text.includes('artifact') || text.includes('equipment')) {
      archetypes.push('artifact');
    }
    if (text.includes('haste') || text.includes('trample') || text.includes('damage')) {
      archetypes.push('aggro');
    }
    
    return archetypes;
  }
  
  private async updateUserPreferences(userId: number, patterns: Map<string, { weight: number, evidence: number }>): Promise<void> {
    for (const [preferenceKey, data] of patterns) {
      const [type, value] = preferenceKey.split('_', 2);
      
      // Only update if we have sufficient evidence
      if (data.evidence >= 2) {
        try {
          // Check if preference exists
          const existing = await db.select()
            .from(userPreferences)
            .where(and(
              eq(userPreferences.userId, userId),
              eq(userPreferences.preferenceType, type),
              eq(userPreferences.preferenceValue, value)
            ))
            .limit(1);
          
          if (existing.length > 0) {
            // Update existing preference
            await db.update(userPreferences)
              .set({
                weight: Math.min(data.weight / data.evidence, 5.0), // Cap at 5.0
                learnedFromInteractions: existing[0].learnedFromInteractions + data.evidence,
                lastUpdated: new Date()
              })
              .where(eq(userPreferences.id, existing[0].id));
          } else {
            // Create new preference
            await db.insert(userPreferences).values({
              userId,
              preferenceType: type,
              preferenceValue: value,
              weight: Math.min(data.weight / data.evidence, 5.0),
              learnedFromInteractions: data.evidence
            });
          }
        } catch (error) {
          console.error(`Error updating preference ${preferenceKey}:`, error);
        }
      }
    }
  }
  
  // Generate context-aware recommendations
  async generateContextAwareRecommendations(
    userId: number, 
    sourceCard: Card, 
    context: { 
      searchTerms?: string[], 
      currentDeck?: Card[], 
      recentViews?: Card[] 
    }
  ): Promise<Card[]> {
    try {
      // Get user preferences
      const preferences = await db.select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .orderBy(desc(userPreferences.weight));
      
      // Find cards that match preferences and context
      const candidates = await this.findContextualCandidates(sourceCard, context, preferences);
      
      // Score and rank candidates
      const scoredCards = await this.scoreByPreferences(candidates, preferences, context);
      
      // Store adaptive recommendations for future learning
      await this.storeAdaptiveRecommendations(userId, sourceCard.id, scoredCards, context);
      
      return scoredCards.slice(0, 20).map(c => c.card);
    } catch (error) {
      console.error('Error generating context-aware recommendations:', error);
      return [];
    }
  }
  
  private async findContextualCandidates(
    sourceCard: Card, 
    context: any, 
    preferences: any[]
  ): Promise<Card[]> {
    const candidates = new Set<string>();
    
    // Base on card relationships
    const relatedCards = await db.select()
      .from(cardCache)
      .where(sql`card_data->>'oracle_text' ILIKE '%' || ${sourceCard.oracle_text?.split(' ')[0] || ''} || '%'`)
      .limit(100);
    
    for (const cached of relatedCards) {
      candidates.add(cached.id);
    }
    
    // Factor in preferences
    for (const pref of preferences.slice(0, 5)) { // Top 5 preferences
      let query = '';
      switch (pref.preferenceType) {
        case 'color':
          query = `card_data->>'mana_cost' ILIKE '%${pref.preferenceValue.toUpperCase()}%'`;
          break;
        case 'type':
          query = `card_data->>'type_line' ILIKE '%${pref.preferenceValue}%'`;
          break;
        case 'archetype':
          query = `card_data->>'oracle_text' ILIKE '%${pref.preferenceValue}%'`;
          break;
      }
      
      if (query) {
        const prefCards = await db.select()
          .from(cardCache)
          .where(sql.raw(query))
          .limit(50);
        
        for (const cached of prefCards) {
          candidates.add(cached.id);
        }
      }
    }
    
    // Get full card data
    const cardIds = Array.from(candidates);
    const cards: Card[] = [];
    
    for (const id of cardIds.slice(0, 200)) { // Limit for performance
      const cached = await db.select()
        .from(cardCache)
        .where(eq(cardCache.id, id))
        .limit(1);
      
      if (cached.length > 0) {
        cards.push(cached[0].cardData);
      }
    }
    
    return cards;
  }
  
  private async scoreByPreferences(
    cards: Card[], 
    preferences: any[], 
    context: any
  ): Promise<Array<{ card: Card, score: number, reasons: string[] }>> {
    const scored = [];
    
    for (const card of cards) {
      let score = 0;
      const reasons = [];
      
      // Score based on user preferences
      for (const pref of preferences) {
        const prefScore = this.calculatePreferenceScore(card, pref);
        if (prefScore > 0) {
          score += prefScore * pref.weight;
          reasons.push(`Matches ${pref.preferenceType} preference`);
        }
      }
      
      // Context bonuses
      if (context.searchTerms) {
        for (const term of context.searchTerms) {
          if (card.name.toLowerCase().includes(term.toLowerCase()) ||
              card.oracle_text?.toLowerCase().includes(term.toLowerCase())) {
            score += 10;
            reasons.push('Relevant to search');
          }
        }
      }
      
      if (score > 0) {
        scored.push({ card, score, reasons });
      }
    }
    
    return scored.sort((a, b) => b.score - a.score);
  }
  
  private calculatePreferenceScore(card: Card, preference: any): number {
    switch (preference.preferenceType) {
      case 'color':
        return card.mana_cost?.includes(preference.preferenceValue.toUpperCase()) ? 20 : 0;
      case 'type':
        return card.type_line.toLowerCase().includes(preference.preferenceValue) ? 25 : 0;
      case 'archetype':
        return card.oracle_text?.toLowerCase().includes(preference.preferenceValue) ? 15 : 0;
      case 'cmc':
        const cmcRange = this.getCMCRange(card.cmc);
        return cmcRange === preference.preferenceValue ? 10 : 0;
      default:
        return 0;
    }
  }
  
  private async storeAdaptiveRecommendations(
    userId: number, 
    sourceCardId: string, 
    recommendations: Array<{ card: Card, score: number, reasons: string[] }>,
    context: any
  ): Promise<void> {
    for (const rec of recommendations.slice(0, 10)) {
      try {
        await db.insert(adaptiveRecommendations).values({
          userId,
          cardId: sourceCardId,
          recommendedCardId: rec.card.id,
          contextType: this.determineContextType(context),
          contextData: context,
          score: rec.score,
          reason: rec.reasons.join(', '),
          adaptationFactors: {
            userPreferences: true,
            searchContext: !!context.searchTerms,
            deckContext: !!context.currentDeck
          }
        });
      } catch (error) {
        console.error('Error storing adaptive recommendation:', error);
      }
    }
  }
  
  private determineContextType(context: any): string {
    if (context.searchTerms) return 'search_context';
    if (context.currentDeck) return 'deck_context';
    return 'general_context';
  }
}

export const adaptiveEngine = new AdaptiveRecommendationEngine();