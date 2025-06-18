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
      // Try Google Gemini first (free tier available)
      if (process.env.GOOGLE_API_KEY) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        this.textGenerator = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        this.isReady = true;
        console.log('Google Gemini AI ready for theme generation');
        return;
      }

      // Try DeepSeek (free alternative)
      if (process.env.DEEPSEEK_API_KEY) {
        const { default: OpenAI } = await import('openai');
        this.textGenerator = new OpenAI({
          apiKey: process.env.DEEPSEEK_API_KEY,
          baseURL: 'https://api.deepseek.com'
        });
        this.isReady = true;
        console.log('DeepSeek AI ready for theme generation');
        return;
      }

      // Fallback to OpenAI if available
      if (process.env.OPENAI_API_KEY) {
        const { default: OpenAI } = await import('openai');
        this.textGenerator = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.isReady = true;
        console.log('OpenAI GPT ready for theme generation');
        return;
      }

      // No AI available
      console.log('No AI API keys available, using basic fallback themes');
      this.isReady = false;
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
            keywords: [theme.theme.toLowerCase()]
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

      if (this.textGenerator.getGenerativeModel) {
        // Using Google Gemini
        try {
          const model = this.textGenerator.getGenerativeModel({ model: "gemini-1.5-flash" });
          const prompt = `You are a Magic: The Gathering expert. Analyze this card and identify 2-3 strategic themes. Be concise.

${cardContext}

Format your response as:
Theme1: Description
Theme2: Description`;

          const result = await model.generateContent(prompt);
          aiResponse = result.response.text() || '';
        } catch (error: any) {
          if (error.status === 429 || error.code === 'RESOURCE_EXHAUSTED') {
            console.log('Gemini quota exceeded, falling back to basic analysis');
            return this.getFallbackThemes(card);
          }
          console.error('Gemini API error:', error);
          return this.getFallbackThemes(card);
        }
      } else if (this.textGenerator.chat) {
        // Using OpenAI-compatible API (DeepSeek or OpenAI)
        try {
          const model = process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini";
          const response = await this.textGenerator.chat.completions.create({
            model: model,
            messages: [
              {
                role: "system",
                content: "You are a Magic: The Gathering expert. Analyze cards and identify 2-3 strategic themes. Be concise."
              },
              {
                role: "user",
                content: `Analyze this Magic card for 2-3 themes:\n\n${cardContext}\n\nFormat: Theme1: Description\nTheme2: Description`
              }
            ],
            max_tokens: 150,
            temperature: 0.2
          });

          aiResponse = response.choices[0]?.message?.content || '';
        } catch (error: any) {
          if (error.status === 429 || error.code === 'insufficient_quota') {
            console.log('AI quota exceeded, falling back to basic analysis');
            return this.getFallbackThemes(card);
          }
          console.error('AI API error:', error);
          return this.getFallbackThemes(card);
        }
      } else {
        // No AI available
        return this.getFallbackThemes(card);
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
        .limit(200); // Process smaller batches for AI analysis

      const scoredCards: Array<{card: Card, score: number}> = [];

      for (const cached of candidates) {
        const card = cached.cardData as Card;
        if (!card?.id) continue;

        // Apply filters early
        if (filters && !this.cardMatchesFilters(card, filters)) continue;

        // Use AI to score card relevance to theme
        const aiScore = await this.scoreCardForThemeWithAI(card, theme);
        if (aiScore > 0.6) {
          scoredCards.push({ card, score: aiScore });
        }

        // Process in smaller batches to avoid overwhelming AI
        if (scoredCards.length >= 15) break;
      }

      return scoredCards
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(item => item.card);

    } catch (error) {
      console.error('AI card matching failed:', error);
      return [];
    }
  }

  // Pure AI-based theme scoring - no hardcoded patterns
  private async scoreCardForThemeWithAI(card: Card, theme: {theme: string, description: string}): Promise<number> {
    if (!this.isReady) return 0;

    try {
      const cardContext = `"${card.name}" (${card.type_line}): ${card.oracle_text || 'No text'}`;
      
      let aiResponse = '';

      if (this.textGenerator.chat) {
        // Using OpenAI GPT
        const response = await this.textGenerator.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a Magic: The Gathering expert. Rate how well a card fits a specific theme on a scale of 0-100. Consider strategic synergies, mechanical interactions, and thematic relevance."
            },
            {
              role: "user",
              content: `Rate how well this card fits the "${theme.theme}" theme (${theme.description}) on a scale of 0-100:\n\nCard: ${cardContext}\n\nRespond with only a number from 0-100:`
            }
          ],
          max_tokens: 10,
          temperature: 0.1
        });

        aiResponse = response.choices[0]?.message?.content || '0';
      } else {
        // Using local transformer
        const prompt = `Rate 0-100 how well this Magic card fits the "${theme.theme}" strategy: "${theme.description}". Card: ${cardContext} - Answer only a number 0-100:`;
        
        const response = await this.textGenerator(prompt, {
          max_new_tokens: 10,
          temperature: 0.2
        });

        aiResponse = response[0]?.generated_text || '0';
      }

      const score = parseInt(aiResponse.match(/\d+/)?.[0] || '0');
      return Math.min(Math.max(score, 0), 100) / 100; // Convert to 0-1 scale

    } catch (error) {
      console.error('AI theme scoring failed:', error);
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

      if (this.textGenerator.getGenerativeModel) {
        // Using Google Gemini
        const model = this.textGenerator.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are a Magic: The Gathering expert. Rate card synergy on a scale of 0-100 and explain why.

Source: ${sourceContext}
Target: ${targetContext}

Provide: SCORE|REASON (e.g., "75|Strong artifact synergy with metalcraft triggers")`;

        const result = await model.generateContent(prompt);
        aiResponse = result.response.text() || '';
      } else if (this.textGenerator.chat) {
        // Using OpenAI-compatible API
        const model = process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini";
        const response = await this.textGenerator.chat.completions.create({
          model: model,
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
        // No AI available
        return this.getBasicSynergy(sourceCard, targetCard);
      }

      const match = aiResponse.match(/(\d{1,3})\s*\|\s*(.+)/);
      if (match) {
        return {
          score: Math.min(parseInt(match[1]) || 0, 100),
          reason: match[2].trim()
        };
      }

      // Use basic synergy if AI parsing fails
      return this.getBasicSynergy(sourceCard, targetCard);
    } catch (error: any) {
      if (error.status === 429 || error.code === 'insufficient_quota' || error.code === 'RESOURCE_EXHAUSTED') {
        console.log('AI quota exceeded, using pattern-based analysis');
        return this.getBasicSynergy(sourceCard, targetCard);
      }
      console.error('AI synergy analysis failed:', error);
      return this.getBasicSynergy(sourceCard, targetCard);
    }
  }

  // Removed hardcoded pattern matching - AI only

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

      // Use basic similarity if AI parsing fails
      return this.getBasicSimilarity(sourceCard, targetCard);
    } catch (error: any) {
      if (error.status === 429 || error.code === 'insufficient_quota' || error.code === 'RESOURCE_EXHAUSTED') {
        console.log('AI quota exceeded, using pattern-based analysis');
        return this.getBasicSimilarity(sourceCard, targetCard);
      }
      console.error('AI similarity analysis failed:', error);
      return this.getBasicSimilarity(sourceCard, targetCard);
    }
  }



  // Basic fallback methods when AI is unavailable
  private getFallbackThemes(card: Card): Array<{theme: string, description: string}> {
    const themes: Array<{theme: string, description: string}> = [];
    const text = (card.oracle_text || '').toLowerCase();
    const type = (card.type_line || '').toLowerCase();

    if (type.includes('creature')) {
      themes.push({
        theme: 'Creature Strategy',
        description: 'Build around creature-focused gameplay'
      });
    }
    
    if (type.includes('instant') || type.includes('sorcery')) {
      themes.push({
        theme: 'Spell Strategy', 
        description: 'Leverage instant and sorcery effects'
      });
    }

    if (type.includes('artifact')) {
      themes.push({
        theme: 'Artifact Strategy',
        description: 'Artifact-based deck construction'
      });
    }

    return themes.slice(0, 2);
  }

  private getBasicSynergy(sourceCard: Card, targetCard: Card): {score: number, reason: string} {
    // Basic synergy based on shared types/mechanics
    const sourceText = (sourceCard.oracle_text || '').toLowerCase();
    const targetText = (targetCard.oracle_text || '').toLowerCase();
    
    let score = 0;
    let reasons = [];

    if (sourceCard.color_identity?.some(c => targetCard.color_identity?.includes(c))) {
      score += 0.2;
      reasons.push('shared colors');
    }

    if (sourceCard.type_line?.includes('Creature') && targetCard.type_line?.includes('Creature')) {
      score += 0.3;
      reasons.push('both creatures');
    }

    return {
      score: Math.min(score, 0.7),
      reason: reasons.join(', ') || 'basic compatibility'
    };
  }

  private getBasicSimilarity(sourceCard: Card, targetCard: Card): {score: number, reason: string} {
    // Basic similarity based on type and cost
    let score = 0;
    let reasons = [];

    if (sourceCard.type_line === targetCard.type_line) {
      score += 0.4;
      reasons.push('same type');
    }

    if (sourceCard.mana_cost === targetCard.mana_cost) {
      score += 0.3;
      reasons.push('same cost');
    }

    return {
      score: Math.min(score, 0.8),
      reason: reasons.join(', ') || 'basic similarity'
    };
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