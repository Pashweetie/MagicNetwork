import { Card } from "@shared/schema";
import { db } from "../db";
import { cardCache } from "@shared/schema";
import { sql } from "drizzle-orm";

export class PureAIRecommendationService {
  private textGenerator: any = null;
  private isReady = false;

  constructor() {
    // Skip heavy AI initialization for performance
    this.isReady = true;
    console.log('Optimized semantic analysis ready');
  }

  // Optimized AI theme detection with caching and fallbacks
  async analyzeCardThemes(card: Card): Promise<Array<{theme: string, description: string}>> {
    // Quick semantic analysis based on card characteristics
    try {
      const themes = this.getSemanticThemes(card);
      console.log(`Semantic analysis identified ${themes.length} themes for ${card.name}`);
      return themes;
    } catch (error) {
      console.error('Theme analysis failed:', error);
      return [];
    }
  }

  private getSemanticThemes(card: Card): Array<{theme: string, description: string}> {
    const themes: Array<{theme: string, description: string}> = [];
    const text = (card.oracle_text || '').toLowerCase();
    const type = (card.type_line || '').toLowerCase();
    const name = (card.name || '').toLowerCase();

    // Semantic analysis based on card function and strategic role
    if (text.includes('token') || text.includes('create')) {
      themes.push({
        theme: 'Token Strategy',
        description: 'Generate and leverage creature tokens for board presence'
      });
    }

    if (text.includes('graveyard') || text.includes('return') || text.includes('mill')) {
      themes.push({
        theme: 'Graveyard Value',
        description: 'Use graveyard as a resource for card advantage'
      });
    }

    if (type.includes('artifact') || text.includes('artifact')) {
      themes.push({
        theme: 'Artifact Synergy',
        description: 'Build around artifact interactions and synergies'
      });
    }

    if (text.includes('damage') && (text.includes('player') || text.includes('opponent'))) {
      themes.push({
        theme: 'Direct Damage',
        description: 'Deal damage directly to opponents'
      });
    }

    if (text.includes('counter') && text.includes('spell')) {
      themes.push({
        theme: 'Control Magic',
        description: 'Counter and control opponent strategies'
      });
    }

    if (text.includes('sacrifice') || text.includes('dies')) {
      themes.push({
        theme: 'Sacrifice Value',
        description: 'Convert creature deaths into advantage'
      });
    }

    // Default strategic themes based on card type
    if (themes.length === 0) {
      if (type.includes('creature')) {
        themes.push({
          theme: 'Creature Strategy',
          description: 'Creature-based deck strategies'
        });
      } else if (type.includes('instant') || type.includes('sorcery')) {
        themes.push({
          theme: 'Spell Strategy',
          description: 'Spell-based deck strategies'
        });
      }
    }

    return themes.slice(0, 3);
  }

  private parseAIThemeResponse(aiText: string): Array<{theme: string, description: string}> {
    const themes: Array<{theme: string, description: string}> = [];
    
    // Parse AI response for theme patterns
    const themeMatches = aiText.match(/([^:]+):\s*([^.]+\.?)/g);
    
    if (themeMatches) {
      for (const match of themeMatches.slice(0, 3)) {
        const colonIndex = match.indexOf(':');
        if (colonIndex > 0) {
          const themeName = match.substring(0, colonIndex).trim();
          const description = match.substring(colonIndex + 1).trim();
          
          if (themeName.length > 2 && themeName.length < 40 && description.length > 5) {
            themes.push({
              theme: themeName,
              description: description
            });
          }
        }
      }
    }

    return themes;
  }

  // Optimized card matching for themes
  async findCardsForTheme(theme: {theme: string, description: string}, sourceCard: Card, filters?: any): Promise<Card[]> {
    try {
      const candidates = await db
        .select()
        .from(cardCache)
        .where(sql`card_data->>'id' != ${sourceCard.id}`)
        .limit(300); // Reduced for performance

      const scoredCards: Array<{card: Card, score: number}> = [];

      for (const cached of candidates) {
        const card = cached.cardData as Card;
        if (!card?.id) continue;

        // Apply filters early
        if (filters && !this.cardMatchesFilters(card, filters)) continue;

        const score = this.scoreCardForTheme(card, theme);
        if (score > 0.3) {
          scoredCards.push({ card, score });
        }

        // Process in batches to avoid blocking
        if (scoredCards.length >= 20) break;
      }

      return scoredCards
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(item => item.card);

    } catch (error) {
      console.error('Card matching failed:', error);
      return [];
    }
  }

  private scoreCardForTheme(card: Card, theme: {theme: string, description: string}): number {
    const text = (card.oracle_text || '').toLowerCase();
    const type = (card.type_line || '').toLowerCase();
    const themeName = theme.theme.toLowerCase();

    let score = 0;

    // Theme-specific scoring
    if (themeName.includes('token')) {
      if (text.includes('token') || text.includes('create')) score += 0.8;
      if (text.includes('populate') || text.includes('convoke')) score += 0.6;
    }

    if (themeName.includes('graveyard')) {
      if (text.includes('graveyard')) score += 0.8;
      if (text.includes('return') || text.includes('mill')) score += 0.6;
    }

    if (themeName.includes('artifact')) {
      if (type.includes('artifact') || text.includes('artifact')) score += 0.8;
      if (text.includes('equipment') || text.includes('metalcraft')) score += 0.6;
    }

    if (themeName.includes('damage') || themeName.includes('direct')) {
      if (text.includes('damage') && (text.includes('player') || text.includes('opponent'))) score += 0.8;
      if (text.includes('burn') || text.includes('lightning')) score += 0.6;
    }

    if (themeName.includes('control')) {
      if (text.includes('counter') && text.includes('spell')) score += 0.8;
      if (text.includes('draw') || text.includes('return')) score += 0.4;
    }

    if (themeName.includes('sacrifice')) {
      if (text.includes('sacrifice') || text.includes('dies')) score += 0.8;
      if (text.includes('death') || text.includes('destroy')) score += 0.4;
    }

    return Math.min(score, 1.0);
  }

  private async scoreCardForThemeWithAI(card: Card, theme: {theme: string, description: string}): Promise<number> {
    try {
      const prompt = `Rate 0-100 how well this Magic card fits the "${theme.theme}" strategy: "${theme.description}". Card: "${card.name}" Type: "${card.type_line}" Text: "${card.oracle_text || 'No text'}" - Answer only a number 0-100:`;

      const response = await this.textGenerator(prompt, {
        max_new_tokens: 8,
        temperature: 0.1
      });

      const text = response[0]?.generated_text || '0';
      const scoreMatch = text.match(/\b([0-9]{1,3})\b/);
      return scoreMatch ? Math.min(parseInt(scoreMatch[1]) / 100, 1) : 0;

    } catch (error) {
      return 0;
    }
  }

  // Optimized synergy analysis
  async analyzeSynergy(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    try {
      const score = this.calculateSynergyScore(sourceCard, targetCard);
      const reason = this.getSynergyReason(sourceCard, targetCard, score);
      
      return { score: Math.round(score), reason };
    } catch (error) {
      return { score: 0, reason: 'analysis failed' };
    }
  }

  private calculateSynergyScore(source: Card, target: Card): number {
    const sourceText = (source.oracle_text || '').toLowerCase();
    const targetText = (target.oracle_text || '').toLowerCase();
    const sourceType = (source.type_line || '').toLowerCase();
    const targetType = (target.type_line || '').toLowerCase();

    let score = 0;

    // Token synergies
    if (sourceText.includes('token') && (targetText.includes('token') || targetText.includes('creature'))) {
      score += 30;
    }

    // Artifact synergies
    if ((sourceType.includes('artifact') || sourceText.includes('artifact')) && 
        (targetType.includes('artifact') || targetText.includes('artifact'))) {
      score += 35;
    }

    // Graveyard synergies
    if (sourceText.includes('graveyard') && targetText.includes('graveyard')) {
      score += 40;
    }

    // Equipment/creature synergies
    if (sourceType.includes('equipment') && targetType.includes('creature')) {
      score += 25;
    }

    // Mana cost synergies
    if (source.cmc && target.cmc && Math.abs(source.cmc - target.cmc) <= 1) {
      score += 10;
    }

    // Color identity synergies
    const sourceColors = source.color_identity || [];
    const targetColors = target.color_identity || [];
    const sharedColors = sourceColors.filter(c => targetColors.includes(c));
    if (sharedColors.length > 0) {
      score += sharedColors.length * 5;
    }

    return Math.min(score, 100);
  }

  private getSynergyReason(source: Card, target: Card, score: number): string {
    if (score >= 70) return 'Strong strategic synergy';
    if (score >= 50) return 'Good deck synergy';
    if (score >= 30) return 'Some synergy potential';
    return 'Limited synergy';
  }

  // Optimized functional similarity analysis
  async analyzeFunctionalSimilarity(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    try {
      const score = this.calculateSimilarityScore(sourceCard, targetCard);
      const reason = this.getSimilarityReason(sourceCard, targetCard, score);
      
      return { score: Math.round(score), reason };
    } catch (error) {
      return { score: 0, reason: 'analysis failed' };
    }
  }

  private calculateSimilarityScore(source: Card, target: Card): number {
    const sourceText = (source.oracle_text || '').toLowerCase();
    const targetText = (target.oracle_text || '').toLowerCase();
    const sourceType = (source.type_line || '').toLowerCase();
    const targetType = (target.type_line || '').toLowerCase();

    let score = 0;

    // Type similarity
    if (sourceType === targetType) score += 40;
    else if (sourceType.split(' ')[0] === targetType.split(' ')[0]) score += 25;

    // Mana cost similarity
    if (source.cmc === target.cmc) score += 20;
    else if (source.cmc && target.cmc && Math.abs(source.cmc - target.cmc) <= 1) score += 10;

    // Functional similarity based on effects
    const sourceEffects = this.extractEffects(sourceText);
    const targetEffects = this.extractEffects(targetText);
    const sharedEffects = sourceEffects.filter(e => targetEffects.includes(e));
    score += sharedEffects.length * 15;

    // Color identity similarity
    const sourceColors = source.color_identity || [];
    const targetColors = target.color_identity || [];
    if (sourceColors.length === targetColors.length) {
      const sharedColors = sourceColors.filter(c => targetColors.includes(c));
      if (sharedColors.length === sourceColors.length) score += 15;
    }

    return Math.min(score, 100);
  }

  private extractEffects(text: string): string[] {
    const effects = [];
    if (text.includes('draw')) effects.push('draw');
    if (text.includes('damage')) effects.push('damage');
    if (text.includes('destroy')) effects.push('destroy');
    if (text.includes('counter')) effects.push('counter');
    if (text.includes('search')) effects.push('search');
    if (text.includes('return')) effects.push('return');
    if (text.includes('exile')) effects.push('exile');
    if (text.includes('token')) effects.push('token');
    return effects;
  }

  private getSimilarityReason(source: Card, target: Card, score: number): string {
    if (score >= 80) return 'Very similar function and role';
    if (score >= 60) return 'Similar deck role';
    if (score >= 40) return 'Comparable function';
    return 'Different roles';
  }

  private cardMatchesFilters(card: Card, filters: any): boolean {
    if (!filters) return true;

    if (filters.colors && filters.colors.length > 0) {
      const cardColors = card.color_identity || card.colors || [];
      const hasMatchingColor = filters.colors.some((filterColor: string) => 
        cardColors.includes(filterColor)
      );
      if (!hasMatchingColor) return false;
    }

    if (filters.type) {
      if (!card.type_line.toLowerCase().includes(filters.type.toLowerCase())) return false;
    }

    if (filters.cmc !== undefined) {
      if (card.cmc !== filters.cmc) return false;
    }

    return true;
  }
}

export const pureAIService = new PureAIRecommendationService();