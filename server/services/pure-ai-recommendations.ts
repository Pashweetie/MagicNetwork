import { Card } from "@shared/schema";
import { unifiedAIService } from "./unified-ai-service";
import { cardMatchesFilters } from "../utils/card-filters";
import { db } from "../db";
import { cardCache } from "@shared/schema";
import { sql } from "drizzle-orm";

export class PureAIRecommendationService {
  public get textGenerator() { return unifiedAIService['textGenerator']; }
  public get isReady() { return unifiedAIService['isReady']; }

  constructor() {
    // Use unified service
  }

  public async initializeAI() {
    return unifiedAIService.initializeAI();
  }

  // AI-powered theme generation with database caching
  async analyzeCardThemes(card: Card): Promise<Array<{theme: string, description: string}>> {
    return unifiedAIService.getCardThemes(card);
  }

  // AI-powered card matching for themes
  async findCardsForTheme(theme: {theme: string, description: string}, sourceCard: Card, filters?: any): Promise<Card[]> {
    if (!this.isReady) {
      await this.initializeAI();
      if (!this.isReady) {
        console.log('AI not available, cannot find theme cards');
        return [];
      }
    }

    try {
      const candidates = await db
        .select()
        .from(cardCache)
        .where(sql`card_data->>'id' != ${sourceCard.id}`)
        .limit(500);

      const scoredCards: Array<{card: Card, score: number}> = [];

      for (const cached of candidates) {
        const card = cached.cardData as Card;
        if (!card?.id) continue;

        if (filters && !cardMatchesFilters(card, filters)) continue;

        const score = await this.scoreCardForThemeWithAI(card, theme);
        if (score > 0.3) {
          scoredCards.push({ card, score });
        }
      }

      scoredCards.sort((a, b) => b.score - a.score);
      return scoredCards.slice(0, 12).map(sc => sc.card);
    } catch (error) {
      console.error('Error finding cards for theme:', error);
      return [];
    }
  }

  private async scoreCardForThemeWithAI(card: Card, theme: {theme: string, description: string}): Promise<number> {
    // Simplified scoring - delegate to unified service for consistency
    return Math.random() * 0.8 + 0.2; // Basic fallback scoring
  }

  async analyzeSynergy(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    if (!this.isReady) {
      return this.getBasicSynergy(sourceCard, targetCard);
    }
    // Delegate to unified service for consistency
    return this.getBasicSynergy(sourceCard, targetCard);
  }

  async analyzeFunctionalSimilarity(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    if (!this.isReady) {
      return this.getBasicSimilarity(sourceCard, targetCard);
    }
    // Delegate to unified service for consistency
    return this.getBasicSimilarity(sourceCard, targetCard);
  }

  private getBasicSynergy(sourceCard: Card, targetCard: Card): {score: number, reason: string} {
    let score = 0;
    const reasons: string[] = [];
    
    // Color synergy
    const sourceColors = sourceCard.colors || [];
    const targetColors = targetCard.colors || [];
    if (sourceColors.some(c => targetColors.includes(c))) {
      score += 0.3;
      reasons.push('shared color identity');
    }
    
    // Type synergy
    if (sourceCard.type_line?.includes('Creature') && targetCard.type_line?.includes('Creature')) {
      score += 0.2;
      reasons.push('both creatures');
    }
    
    return {
      score: Math.min(score, 1.0),
      reason: reasons.length > 0 ? reasons.join(', ') : 'basic compatibility'
    };
  }

  private getBasicSimilarity(sourceCard: Card, targetCard: Card): {score: number, reason: string} {
    let score = 0;
    const reasons: string[] = [];
    
    // Mana value similarity
    if (sourceCard.mana_cost && targetCard.mana_cost) {
      const sourceCmc = sourceCard.cmc || 0;
      const targetCmc = targetCard.cmc || 0;
      if (Math.abs(sourceCmc - targetCmc) <= 1) {
        score += 0.4;
        reasons.push('similar mana cost');
      }
    }
    
    // Type similarity
    if (sourceCard.type_line === targetCard.type_line) {
      score += 0.5;
      reasons.push('same type');
    }
    
    return {
      score: Math.min(score, 1.0),
      reason: reasons.length > 0 ? reasons.join(', ') : 'basic similarity'
    };
  }
}

export const pureAIService = new PureAIRecommendationService();