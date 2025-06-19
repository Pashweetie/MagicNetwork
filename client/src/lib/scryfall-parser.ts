import { SearchFilters } from "@shared/schema";

export class ScryfallParser {
  // Convert SearchFilters to Scryfall query string for search bar display
  static filtersToQuery(filters: SearchFilters): string {
    const parts: string[] = [];

    // Basic query text
    if (filters.query) {
      parts.push(filters.query);
    }

    // Colors
    if (filters.colors?.length) {
      const colorQuery = filters.colors.map(c => `c:${c.toLowerCase()}`).join(' ');
      parts.push(colorQuery);
    }

    // Types
    if (filters.types?.length) {
      const typeQuery = filters.types.map(t => `t:${t.toLowerCase()}`).join(' ');
      parts.push(typeQuery);
    }

    // Rarities
    if (filters.rarities?.length) {
      const rarityQuery = filters.rarities.map(r => `r:${r.toLowerCase()}`).join(' ');
      parts.push(rarityQuery);
    }

    // Oracle text
    if (filters.oracleText) {
      const words = filters.oracleText.trim().split(/\s+/);
      const oracleQueries = words.map(word => `o:${word}`);
      parts.push(...oracleQueries);
    }

    // CMC
    if (filters.minMv !== undefined && filters.maxMv !== undefined) {
      if (filters.minMv === filters.maxMv) {
        parts.push(`cmc:${filters.minMv}`);
      } else {
        parts.push(`cmc>=${filters.minMv}`, `cmc<=${filters.maxMv}`);
      }
    } else if (filters.minMv !== undefined) {
      parts.push(`cmc>=${filters.minMv}`);
    } else if (filters.maxMv !== undefined) {
      parts.push(`cmc<=${filters.maxMv}`);
    }

    // Set
    if (filters.set) {
      parts.push(`s:${filters.set}`);
    }

    return parts.join(' ');
  }

  // Parse a scryfall query string into SearchFilters
  static parseQuery(query: string): SearchFilters {
    const filters: SearchFilters = {};
    
    if (!query || !query.trim()) {
      return filters;
    }

    // Simple parsing for common patterns
    const parts = query.split(' ');
    const remainingParts: string[] = [];

    for (const part of parts) {
      if (part.startsWith('t:')) {
        const type = part.substring(2);
        if (!filters.types) filters.types = [];
        if (!filters.types.includes(type)) {
          filters.types.push(type);
        }
      } else if (part.startsWith('c:')) {
        const color = part.substring(2).toUpperCase();
        if (!filters.colors) filters.colors = [];
        if (!filters.colors.includes(color)) {
          filters.colors.push(color);
        }
      } else if (part.startsWith('r:')) {
        const rarity = part.substring(2);
        if (!filters.rarities) filters.rarities = [];
        if (!filters.rarities.includes(rarity)) {
          filters.rarities.push(rarity);
        }
      } else if (part.startsWith('o:')) {
        const text = part.substring(2);
        if (!filters.oracleText) {
          filters.oracleText = text;
        } else {
          filters.oracleText += ' ' + text;
        }
      } else if (part.startsWith('s:')) {
        filters.set = part.substring(2);
      } else if (part.startsWith('cmc:')) {
        const cmc = parseInt(part.substring(4));
        if (!isNaN(cmc)) {
          filters.minMv = cmc;
          filters.maxMv = cmc;
        }
      } else if (part.startsWith('cmc>=')) {
        const cmc = parseInt(part.substring(5));
        if (!isNaN(cmc)) {
          filters.minMv = cmc;
        }
      } else if (part.startsWith('cmc<=')) {
        const cmc = parseInt(part.substring(5));
        if (!isNaN(cmc)) {
          filters.maxMv = cmc;
        }
      } else if (part.startsWith('pow:')) {
        const powerStr = part.substring(4);
        filters.power = powerStr;
      } else if (part.startsWith('tou:')) {
        const toughnessStr = part.substring(4);
        filters.toughness = toughnessStr;
      } else if (part.startsWith('usd:')) {
        const price = parseFloat(part.substring(4));
        if (!isNaN(price)) {
          filters.minPrice = price;
          filters.maxPrice = price;
        }
      } else if (part.startsWith('usd>=')) {
        const price = parseFloat(part.substring(5));
        if (!isNaN(price)) {
          filters.minPrice = price;
        }
      } else if (part.startsWith('usd<=')) {
        const price = parseFloat(part.substring(5));
        if (!isNaN(price)) {
          filters.maxPrice = price;
        }
      } else if (part.startsWith('id<=') || part.startsWith('id:')) {
        // Keep color identity filters in the query string for Scryfall
        remainingParts.push(part);
      } else {
        remainingParts.push(part);
      }
    }

    if (remainingParts.length > 0) {
      filters.query = remainingParts.join(' ');
    }

    return filters;
  }
}

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

  static buildQuery(filters: SearchFilters): string {
    const parts: string[] = [];

    // Color identity search
    if (filters.colors && filters.colors.length > 0) {
      const colorQuery = filters.colors.map(color => `c:${color.toLowerCase()}`).join(' OR ');
      if (filters.colors.length > 1) {
        parts.push(`(${colorQuery})`);
      } else {
        parts.push(colorQuery);
      }
    }

    // Type line search
    if (filters.types && filters.types.length > 0) {
      const typeQuery = filters.types.map(type => `t:${type}`).join(' OR ');
      if (filters.types.length > 1) {
        parts.push(`(${typeQuery})`);
      } else {
        parts.push(typeQuery);
      }
    }

    // Rarity search
    if (filters.rarities && filters.rarities.length > 0) {
      const rarityQuery = filters.rarities.map(rarity => `r:${rarity}`).join(' OR ');
      if (filters.rarities.length > 1) {
        parts.push(`(${rarityQuery})`);
      } else {
        parts.push(rarityQuery);
      }
    }

    // CMC range - use minMv/maxMv which exist in SearchFilters
    if (filters.minMv !== undefined || filters.maxMv !== undefined) {
      if (filters.minMv !== undefined && filters.maxMv !== undefined) {
        if (filters.minMv === filters.maxMv) {
          parts.push(`cmc:${filters.minMv}`);
        } else {
          parts.push(`cmc>=${filters.minMv} cmc<=${filters.maxMv}`);
        }
      } else if (filters.minMv !== undefined) {
        parts.push(`cmc>=${filters.minMv}`);
      } else if (filters.maxMv !== undefined) {
        parts.push(`cmc<=${filters.maxMv}`);
      }
    }

    // Oracle text search - split words and create AND logic
    if (filters.oracleText && filters.oracleText.trim()) {
      const words = filters.oracleText.trim().split(/\s+/);
      const oracleQueries = words.map(word => `o:${word}`);
      parts.push(...oracleQueries);
    }

    // Set search
    if (filters.set && filters.set.trim()) {
      parts.push(`s:${filters.set.trim()}`);
    }

    return parts.join(' ');
  }

  static filtersToDisplayText(filters: SearchFilters): string {
    const parts: string[] = [];
    
    if (filters.colors?.length) {
      parts.push(`Colors: ${filters.colors.join(', ')}`);
    }
    
    if (filters.types?.length) {
      parts.push(`Types: ${filters.types.join(', ')}`);
    }
    
    if (filters.rarities?.length) {
      parts.push(`Rarity: ${filters.rarities.join(', ')}`);
    }
    
    if (filters.oracleText) {
      parts.push(`Oracle: ${filters.oracleText}`);
    }
    
    if (filters.set) {
      parts.push(`Set: ${filters.set}`);
    }
    
    if (filters.minMv !== undefined || filters.maxMv !== undefined) {
      if (filters.minMv === filters.maxMv) {
        parts.push(`CMC: ${filters.minMv}`);
      } else if (filters.minMv !== undefined && filters.maxMv !== undefined) {
        parts.push(`CMC: ${filters.minMv}-${filters.maxMv}`);
      } else if (filters.minMv !== undefined) {
        parts.push(`CMC: ${filters.minMv}+`);
      } else {
        parts.push(`CMC: ≤${filters.maxMv}`);
      }
    }
    
    return parts.join(' | ');
  }
}
