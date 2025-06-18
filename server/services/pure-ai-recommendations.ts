import { Card } from "@shared/schema";
import { db } from "../db";
import { cardCache, cardThemes } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

export class PureAIRecommendationService {
  private textGenerator: any = null;
  private isReady = false;

  constructor() {
    this.initializeAI();
  }

  private async initializeAI() {
    if (this.isReady) return;
    
    try {
      // Try OpenAI first if available
      if (process.env.OPENAI_API_KEY) {
        const { default: OpenAI } = await import('openai');
        this.textGenerator = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.isReady = true;
        console.log('OpenAI GPT ready for theme generation');
        return;
      }

      // Fallback to local transformer
      const { pipeline } = await import('@xenova/transformers');
      console.log('Loading local neural network for theme analysis...');
      this.textGenerator = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
      this.isReady = true;
      console.log('Local neural network ready for theme analysis');
    } catch (error) {
      console.error('Failed to initialize AI:', error);
      this.isReady = false;
    }
  }

  // AI-powered theme generation with database caching
  async analyzeCardThemes(card: Card): Promise<Array<{theme: string, description: string}>> {
    if (!this.isReady) {
      await this.initializeAI();
      if (!this.isReady) {
        console.log('AI not available, cannot generate themes');
        return [];
      }
    }

    try {
      // Check if themes already exist in database
      const existingThemes = await db
        .select()
        .from(cardThemes)
        .where(eq(cardThemes.card_id, card.id))
        .limit(5);

      if (existingThemes.length > 0) {
        console.log(`Using cached themes for ${card.name}`);
        return existingThemes.map(theme => ({
          theme: theme.theme_name,
          description: theme.description || `${theme.theme_name} strategy`
        }));
      }

      // Generate new themes with AI
      const aiThemes = await this.generateThemesWithAI(card);
      
      // Store in database for future use
      for (const theme of aiThemes) {
        try {
          await db.insert(cardThemes).values({
            card_id: card.id,
            theme_name: theme.theme,
            theme_category: 'AI-Generated',
            description: theme.description,
            confidence: 0.8,
            keywords: [theme.theme.toLowerCase()],
            search_terms: [theme.theme.toLowerCase()]
          });
        } catch (error) {
          // Theme might already exist, continue
          console.log(`Theme already exists: ${theme.theme}`);
        }
      }

      console.log(`AI generated ${aiThemes.length} themes for ${card.name}`);
      return aiThemes;
    } catch (error) {
      console.error('AI theme analysis failed:', error);
      return [];
    }
  }

  private async generateThemesWithAI(card: Card): Promise<Array<{theme: string, description: string}>> {
    try {
      const cardContext = `Card: "${card.name}"
Type: ${card.type_line}
Mana Cost: ${card.mana_cost || 'None'}
Oracle Text: ${card.oracle_text || 'No text'}`;

      let aiResponse = '';

      if (this.textGenerator.chat) {
        // Using OpenAI GPT
        const response = await this.textGenerator.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a Magic: The Gathering deck building expert. Analyze cards and identify 2-3 strategic deck themes they support. Be specific and strategic, avoiding generic terms. Focus on actual deck archetypes and strategies."
            },
            {
              role: "user",
              content: `Analyze this Magic card and identify 2-3 specific strategic themes it supports:\n\n${cardContext}\n\nFormat your response as:\nTheme1: Brief description\nTheme2: Brief description\nTheme3: Brief description (if applicable)`
            }
          ],
          max_tokens: 200,
          temperature: 0.3
        });

        aiResponse = response.choices[0]?.message?.content || '';
      } else {
        // Using local transformer
        const prompt = `Analyze this Magic card for strategic deck themes: ${cardContext} - List 2-3 strategic themes like "Voltron Equipment", "Token Swarm", "Reanimator", etc. Format: Theme1: Description. Theme2: Description.`;
        
        const response = await this.textGenerator(prompt, {
          max_new_tokens: 100,
          temperature: 0.4
        });

        aiResponse = response[0]?.generated_text || '';
      }

      return this.parseAIThemeResponse(aiResponse);
    } catch (error) {
      console.error('AI theme generation failed:', error);
      return [];
    }
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

  // AI-powered synergy analysis
  async analyzeSynergy(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    if (!this.isReady) {
      await this.initializeAI();
      if (!this.isReady) {
        return { score: 0, reason: 'AI not available' };
      }
    }

    try {
      let aiResponse = '';
      const sourceContext = `"${sourceCard.name}" (${sourceCard.type_line}): ${sourceCard.oracle_text || 'No text'}`;
      const targetContext = `"${targetCard.name}" (${targetCard.type_line}): ${targetCard.oracle_text || 'No text'}`;

      if (this.textGenerator.chat) {
        // Using OpenAI GPT
        const response = await this.textGenerator.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a Magic: The Gathering expert. Rate card synergy on a scale of 0-100 and explain why. Focus on mechanical interactions, strategic synergies, and deck building potential."
            },
            {
              role: "user",
              content: `Rate the synergy between these Magic cards (0-100):\n\nSource: ${sourceContext}\n\nTarget: ${targetContext}\n\nProvide: SCORE|REASON (e.g., "75|Strong artifact synergy with metalcraft triggers")`
            }
          ],
          max_tokens: 100,
          temperature: 0.2
        });

        aiResponse = response.choices[0]?.message?.content || '';
      } else {
        // Using local transformer
        const prompt = `Rate synergy 0-100 between Magic cards. Source: ${sourceContext} Target: ${targetContext} - Do they work well together? Format: NUMBER|reason`;
        
        const response = await this.textGenerator(prompt, {
          max_new_tokens: 50,
          temperature: 0.3
        });

        aiResponse = response[0]?.generated_text || '';
      }

      const match = aiResponse.match(/(\d{1,3})\s*\|\s*(.+)/);
      if (match) {
        return {
          score: Math.min(parseInt(match[1]) || 0, 100),
          reason: match[2].trim()
        };
      }

      // Fallback to pattern analysis
      const fallbackScore = this.calculateSynergyScore(sourceCard, targetCard);
      return {
        score: Math.round(fallbackScore),
        reason: this.getSynergyReason(sourceCard, targetCard, fallbackScore)
      };
    } catch (error) {
      console.error('AI synergy analysis failed:', error);
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

  // AI-powered functional similarity analysis
  async analyzeFunctionalSimilarity(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    if (!this.isReady) {
      await this.initializeAI();
      if (!this.isReady) {
        return { score: 0, reason: 'AI not available' };
      }
    }

    try {
      let aiResponse = '';
      const sourceContext = `"${sourceCard.name}" (${sourceCard.type_line}): ${sourceCard.oracle_text || 'No text'}`;
      const targetContext = `"${targetCard.name}" (${targetCard.type_line}): ${targetCard.oracle_text || 'No text'}`;

      if (this.textGenerator.chat) {
        // Using OpenAI GPT
        const response = await this.textGenerator.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a Magic: The Gathering expert. Rate functional similarity between cards on a scale of 0-100. Focus on whether they serve similar roles in decks, have comparable effects, or fill similar strategic niches."
            },
            {
              role: "user",
              content: `Rate the functional similarity between these Magic cards (0-100):\n\nSource: ${sourceContext}\n\nTarget: ${targetContext}\n\nProvide: SCORE|REASON (e.g., "85|Both are 3-mana removal spells with similar effects")`
            }
          ],
          max_tokens: 100,
          temperature: 0.2
        });

        aiResponse = response.choices[0]?.message?.content || '';
      } else {
        // Using local transformer
        const prompt = `Rate functional similarity 0-100 between Magic cards. Source: ${sourceContext} Target: ${targetContext} - Do they serve similar deck purposes? Format: NUMBER|reason`;
        
        const response = await this.textGenerator(prompt, {
          max_new_tokens: 50,
          temperature: 0.3
        });

        aiResponse = response[0]?.generated_text || '';
      }

      const match = aiResponse.match(/(\d{1,3})\s*\|\s*(.+)/);
      if (match) {
        return {
          score: Math.min(parseInt(match[1]) || 0, 100),
          reason: match[2].trim()
        };
      }

      // Fallback to pattern analysis
      const fallbackScore = this.calculateSimilarityScore(sourceCard, targetCard);
      return {
        score: Math.round(fallbackScore),
        reason: this.getSimilarityReason(sourceCard, targetCard, fallbackScore)
      };
    } catch (error) {
      console.error('AI similarity analysis failed:', error);
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