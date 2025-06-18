import { SearchFilters } from "@shared/schema";

export class ScryfallQueryParser {
  private static colorMap: Record<string, string> = {
    'w': 'W',
    'u': 'U', 
    'b': 'B',
    'r': 'R',
    'g': 'G',
    'white': 'W',
    'blue': 'U',
    'black': 'B',
    'red': 'R',
    'green': 'G',
  };

  static parseQuery(query: string): SearchFilters {
    const filters: SearchFilters = {};
    const tokens = this.tokenizeQuery(query);
    const remainingTerms: string[] = [];

    for (const token of tokens) {
      if (this.isTaggedTerm(token)) {
        this.parseTaggedTerm(token, filters);
      } else {
        remainingTerms.push(token);
      }
    }

    if (remainingTerms.length > 0) {
      filters.query = remainingTerms.join(' ');
    }

    return filters;
  }

  private static tokenizeQuery(query: string): string[] {
    // Split on spaces but preserve quoted strings
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ' ' && !inQuotes) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      tokens.push(current.trim());
    }

    return tokens;
  }

  private static isTaggedTerm(token: string): boolean {
    return /^[a-zA-Z]+:/.test(token);
  }

  private static parseTaggedTerm(token: string, filters: SearchFilters): void {
    const [tag, value] = token.split(':', 2);
    
    switch (tag.toLowerCase()) {
      case 'c':
      case 'color':
      case 'colors':
        ScryfallQueryParser.parseColors(value, filters);
        break;
      case 't':
      case 'type':
      case 'types':
        ScryfallQueryParser.parseTypes(value, filters);
        break;
      case 'r':
      case 'rarity':
        ScryfallQueryParser.parseRarities(value, filters);
        break;
      case 'f':
      case 'format':
        filters.format = value;
        break;
      case 'mv':
      case 'manavalue':
      case 'cmc':
        ScryfallQueryParser.parseManaValue(value, filters);
        break;
      case 'o':
      case 'oracle':
        filters.oracleText = value.replace(/['"]/g, '');
        break;
      case 's':
      case 'set':
        filters.set = value;
        break;
      case 'a':
      case 'artist':
        filters.artist = value.replace(/['"]/g, '');
        break;
      case 'pow':
      case 'power':
        filters.power = value;
        break;
      case 'tou':
      case 'toughness':
        filters.toughness = value;
        break;
      case 'loy':
      case 'loyalty':
        filters.loyalty = value;
        break;
      case 'usd':
      case 'price':
        ScryfallQueryParser.parsePrice(value, filters);
        break;
      case 'ci':
      case 'coloridentity':
      case 'id':
        ScryfallQueryParser.parseColorIdentity(value, filters);
        break;
      case 'k':
      case 'keyword':
      case 'kw':
        ScryfallQueryParser.parseKeywords(value, filters);
        break;
      case 'produces':
      case 'mana':
        ScryfallQueryParser.parseProduces(value, filters);
        break;
    }
  }

  private static parseColors(value: string, filters: SearchFilters): void {
    // Handle color combinations like "ur", "wubrg", etc.
    const colors: string[] = [];
    
    for (const char of value.toLowerCase()) {
      const color = this.colorMap[char];
      if (color && !colors.includes(color)) {
        colors.push(color);
      }
    }
    
    if (colors.length > 0) {
      filters.colors = colors;
    }
  }

  private static parseTypes(value: string, filters: SearchFilters): void {
    const types = value.split(/[,|]/).map(t => t.trim().toLowerCase());
    filters.types = types;
  }

  private static parseRarities(value: string, filters: SearchFilters): void {
    const rarityMap: Record<string, string> = {
      'c': 'common',
      'u': 'uncommon', 
      'r': 'rare',
      'm': 'mythic',
      'common': 'common',
      'uncommon': 'uncommon',
      'rare': 'rare',
      'mythic': 'mythic',
    };

    const rarities = value.split(/[,|]/).map(r => {
      const mapped = rarityMap[r.trim().toLowerCase()];
      return mapped;
    }).filter(Boolean);

    if (rarities.length > 0) {
      filters.rarities = rarities;
    }
  }

  private static parseManaValue(value: string, filters: SearchFilters): void {
    // Handle operators like >=3, <=5, =2, >1, <4
    const match = value.match(/^([><=]+)?(\d+)$/);
    if (!match) return;

    const [, operator, numberStr] = match;
    const number = parseInt(numberStr);

    if (operator === '>=' || operator === '>') {
      filters.minMv = number;
    } else if (operator === '<=' || operator === '<') {
      filters.maxMv = number;
    } else {
      // Exact match - set both min and max
      filters.minMv = number;
      filters.maxMv = number;
    }
  }

  private static parsePrice(value: string, filters: SearchFilters): void {
    const match = value.match(/^([><=]+)?(\d+(?:\.\d+)?)$/);
    if (!match) return;

    const [, operator, numberStr] = match;
    const number = parseFloat(numberStr);

    if (operator === '>=' || operator === '>') {
      filters.minPrice = number;
    } else if (operator === '<=' || operator === '<') {
      filters.maxPrice = number;
    } else {
      filters.minPrice = number;
      filters.maxPrice = number;
    }
  }

  private static parseColorIdentity(value: string, filters: SearchFilters): void {
    const colors: string[] = [];
    
    for (const char of value.toLowerCase()) {
      const color = this.colorMap[char];
      if (color && !colors.includes(color)) {
        colors.push(color);
      }
    }
    
    if (colors.length > 0) {
      filters.colorIdentity = colors;
    }
  }

  private static parseKeywords(value: string, filters: SearchFilters): void {
    const keywords = value.split(/[,|]/).map(k => k.trim().toLowerCase());
    filters.keywords = keywords;
  }

  private static parseProduces(value: string, filters: SearchFilters): void {
    const colors: string[] = [];
    
    for (const char of value.toLowerCase()) {
      const color = this.colorMap[char];
      if (color && !colors.includes(color)) {
        colors.push(color);
      }
    }
    
    if (colors.length > 0) {
      filters.produces = colors;
    }
  }
}
