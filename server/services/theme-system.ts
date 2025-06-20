import { db } from "../db";
import { cardThemes, themeRelationships, userThemeFeedback } from "@shared/schema";
import { storage } from "../storage";
import { pureAIService } from "./pure-ai-recommendations";
import { eq, and, inArray, desc, sql, or } from "drizzle-orm";
import { Card, CardTheme, InsertCardTheme, ThemeRelationship, InsertThemeRelationship } from "@shared/schema";

export class ThemeSystem {
  constructor() {}

  async generateCardThemes(card: Card): Promise<Array<{theme: string, description: string, confidence: number, category: string}>> {
    try {
      // Check if themes already exist
      const existingThemes = await storage.getCardThemes(card.id);
      if (existingThemes.length > 0) {
        return existingThemes.map(t => ({
          theme: t.theme_name,
          description: t.description || '',
          confidence: t.final_score / 100, // Use unified final_score
          category: t.theme_category
        }));
      }

      // Generate themes using AI
      if (pureAIService.isReady && pureAIService.textGenerator) {
        const themes = await this.generateThemesWithAI(card);
        
        // Store themes in database
        for (const themeData of themes) {
          try {
            await storage.createCardTheme({
              card_id: card.id,
              theme_name: themeData.theme,
              theme_category: themeData.category,
              confidence: Math.round(themeData.confidence * 100), // Convert 0-1 to 0-100
              description: themeData.description,
              keywords: this.extractKeywords(card, themeData.theme)
            });
          } catch (error) {
            console.error('Failed to store theme:', error);
          }
        }
        
        return themes;
      }

      // No fallback - return empty if AI fails
      return [];
    } catch (error) {
      console.error('Error generating card themes:', error);
      return [];
    }
  }

  private async generateThemesWithAI(card: Card): Promise<Array<{theme: string, description: string, confidence: number, category: string}>> {
    try {
      if (!pureAIService.textGenerator?.getGenerativeModel) {
        return [];
      }

      const model = pureAIService.textGenerator.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Analyze this Magic: The Gathering card and identify ALL strategic themes it supports:

Card Name: ${card.name}
Type: ${card.type_line}
Mana Cost: ${card.mana_cost || 'N/A'}
Oracle Text: ${card.oracle_text || 'N/A'}
Power/Toughness: ${card.power && card.toughness ? `${card.power}/${card.toughness}` : 'N/A'}

CRITICAL RULES:
- Only identify themes directly supported by this card's mechanics, abilities, or characteristics
- Theme names must be clean text without markdown, numbers, or special formatting
- Confidence must be a decimal between 0.1 and 1.0
- Generate all themes the card actually supports (could be 1-8+ themes)

Required JSON format (no additional text):
[
  {
    "theme": "Flying",
    "description": "Has flying ability for evasion",
    "confidence": 0.95,
    "category": "mechanic"
  }
]

Categories: strategy, archetype, mechanic, synergy`;

      const result = await model.generateContent(prompt);
      const response = result.response.text() || '';
      
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const themes = JSON.parse(jsonMatch[0]);
          return themes.filter((t: any) => 
            t.theme && t.description && typeof t.confidence === 'number' && t.category &&
            t.confidence >= 0.1 && t.confidence <= 1.0 && // Valid confidence range
            !isNaN(t.confidence) && // Ensure not NaN
            typeof t.theme === 'string' && t.theme.trim().length > 0 // Valid theme name
          ).map((t: any) => ({
            ...t,
            theme: t.theme.replace(/^\*+\s*\d*\.?\s*/, '').trim(), // Clean formatting
            confidence: Math.max(0.1, Math.min(1.0, t.confidence)) // Clamp confidence
          }));
        }
      } catch (parseError) {
        console.error('AI theme parsing failed:', parseError);
      }
    } catch (error) {
      console.error('AI theme generation failed:', error);
    }

    return [];
  }

  private getFallbackThemes(card: Card): Array<{theme: string, description: string, confidence: number, category: string}> {
    const themes: Array<{theme: string, description: string, confidence: number, category: string}> = [];
    const text = (card.oracle_text || '').toLowerCase();
    const typeLine = card.type_line.toLowerCase();

    // Strategy-based themes
    if (card.cmc <= 3 && (typeLine.includes('creature') || typeLine.includes('instant') || typeLine.includes('sorcery'))) {
      themes.push({
        theme: 'Aggro',
        description: 'Low-cost spell for aggressive strategies',
        confidence: 0.7,
        category: 'strategy'
      });
    }

    if (card.cmc >= 6) {
      themes.push({
        theme: 'Late Game',
        description: 'High-cost spell for control/midrange decks',
        confidence: 0.8,
        category: 'strategy'
      });
    }

    // Mechanic-based themes
    if (text.includes('flying')) {
      themes.push({
        theme: 'Flying',
        description: 'Evasive creatures and flying synergies',
        confidence: 0.9,
        category: 'mechanic'
      });
    }

    if (text.includes('artifact') || typeLine.includes('artifact')) {
      themes.push({
        theme: 'Artifacts',
        description: 'Artifact synergies and interactions',
        confidence: 0.85,
        category: 'archetype'
      });
    }

    if (text.includes('graveyard') || text.includes('return') && text.includes('battlefield')) {
      themes.push({
        theme: 'Graveyard Value',
        description: 'Graveyard interactions and recursion',
        confidence: 0.8,
        category: 'synergy'
      });
    }

    if (text.includes('counter') || text.includes('+1/+1')) {
      themes.push({
        theme: 'Counters',
        description: '+1/+1 counters and counter synergies',
        confidence: 0.75,
        category: 'mechanic'
      });
    }

    // Color-based themes
    if (card.colors && card.colors.length > 1) {
      themes.push({
        theme: 'Multicolor',
        description: 'Multicolor synergies and fixing',
        confidence: 0.7,
        category: 'archetype'
      });
    }

    return themes.slice(0, 4); // Limit to top 4 themes
  }

  private extractKeywords(card: Card, theme: string): string[] {
    const keywords: string[] = [];
    const text = (card.oracle_text || '').toLowerCase();
    const typeLine = card.type_line.toLowerCase();

    // Extract relevant keywords based on theme
    const keywordMap: Record<string, string[]> = {
      'flying': ['flying', 'reach'],
      'aggro': ['haste', 'first strike', 'double strike'],
      'artifacts': ['artifact', 'equipment', 'vehicle'],
      'counters': ['counter', '+1/+1', 'proliferate'],
      'graveyard': ['graveyard', 'return', 'exile'],
      'control': ['counter', 'draw', 'destroy']
    };

    const themeKeywords = keywordMap[theme.toLowerCase()] || [];
    for (const keyword of themeKeywords) {
      if (text.includes(keyword) || typeLine.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  async findCardsForTheme(theme: {theme: string, description: string}, sourceCard: Card, filters?: any): Promise<Card[]> {
    try {
      // Find cards with the same theme
      const themeCards = await storage.findCardsByThemes([theme.theme], filters);
      
      // Score and filter cards
      const scoredCards: Array<{card: Card, score: number}> = [];
      
      for (const card of themeCards) {
        if (card.id === sourceCard.id) continue;
        
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
    // Get card themes and calculate relevance
    const cardThemes = await storage.getCardThemes(card.id);
    const matchingTheme = cardThemes.find(t => t.theme_name.toLowerCase() === theme.theme.toLowerCase());
    
    if (matchingTheme) {
      return matchingTheme.final_score / 100; // Use unified final_score
    }
    
    // No fallback scoring - return 0 if no database match
    return 0;
  }

  async findSynergisticCards(cardId: string, filters?: any): Promise<Array<{card: Card, score: number, reason: string}>> {
    const cardThemes = await storage.getCardThemes(cardId);
    if (cardThemes.length === 0) {
      return [];
    }

    const synergisticCards: Array<{card: Card, score: number, reason: string}> = [];
    
    for (const cardTheme of cardThemes) {
      const relationships = await storage.getThemeRelationships(cardTheme.theme_name);
      
      for (const relationship of relationships) {
        if (relationship.synergyScore > 0.6) {
          const relatedTheme = relationship.sourceTheme === cardTheme.theme_name ? 
            relationship.targetTheme : relationship.sourceTheme;
          
          const relatedCards = await storage.findCardsByThemes([relatedTheme], filters);
          
          for (const card of relatedCards) {
            if (card.id !== cardId) {
              synergisticCards.push({
                card,
                score: relationship.synergyScore,
                reason: `${cardTheme.theme_name} synergizes with ${relatedTheme}`
              });
            }
          }
        }
      }
    }

    // Sort by score and remove duplicates
    return synergisticCards
      .sort((a, b) => b.score - a.score)
      .filter((card, index, arr) => 
        arr.findIndex(c => c.card.id === card.card.id) === index
      )
      .slice(0, 20);
  }

  async generateThemeRelationships(theme1: string, theme2: string): Promise<{synergyScore: number, relationshipType: string}> {
    try {
      if (pureAIService.textGenerator?.getGenerativeModel) {
        const model = pureAIService.textGenerator.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analyze the synergy between these two Magic: The Gathering strategy themes:

Theme 1: ${theme1}
Theme 2: ${theme2}

Rate their synergy from 0-100 and classify the relationship:
- synergy: Themes work well together (60-100)
- neutral: Themes are independent (40-59)
- antagony: Themes work against each other (0-39)

Consider factors like:
- Shared strategic goals
- Complementary mechanics
- Resource competition
- Timing conflicts

Respond with: SCORE|TYPE
Example: 85|synergy`;

        const result = await model.generateContent(prompt);
        const response = result.response.text() || '';
        
        const match = response.match(/(\d+)\s*\|\s*(synergy|neutral|antagony)/i);
        if (match) {
          return {
            synergyScore: parseInt(match[1]) / 100,
            relationshipType: match[2].toLowerCase()
          };
        }
      }
    } catch (error) {
      console.error('AI relationship generation failed:', error);
    }

    // No fallback - return neutral if AI fails
    return { synergyScore: 0.5, relationshipType: 'neutral' };
  }


}

export const themeSystem = new ThemeSystem();