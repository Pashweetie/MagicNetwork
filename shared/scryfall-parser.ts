import { SearchFilters } from "./schema";

export class ScryfallQueryParser {
  private static readonly colorMap: Record<string, string> = {
    'w': 'white',
    'u': 'blue', 
    'b': 'black',
    'r': 'red',
    'g': 'green',
    'c': 'colorless'
  };

  static parseQuery(query: string): SearchFilters {
    if (!query || typeof query !== 'string') {
      return {};
    }

    const filters: SearchFilters = {};
    const tokens = this.tokenize(query);

    for (const token of tokens) {
      if (this.isTaggedTerm(token)) {
        this.parseTaggedTerm(token, filters);
      } else {
        // Add to general query text for cards that don't match specific patterns
        if (!filters.query) {
          filters.query = token;
        } else {
          filters.query += ' ' + token;
        }
      }
    }

    return filters;
  }

  private static tokenize(query: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
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
        this.parseColors(value, filters);
        break;
      case 't':
      case 'type':
      case 'types':
        this.parseTypes(value, filters);
        break;
      case 'st':
      case 'subtype':
      case 'subtypes':
        this.parseSubtypes(value, filters);
        break;
      case 'sup':
      case 'super':
      case 'supertype':
      case 'supertypes':
        this.parseSupertypes(value, filters);
        break;
      case 'r':
      case 'rarity':
        this.parseRarities(value, filters);
        break;
      case 'f':
      case 'format':
        filters.format = value;
        break;
      case 'legal':
        filters.legal = value;
        break;
      case 'banned':
        filters.banned = value;
        break;
      case 'restricted':
        filters.restricted = value;
        break;
      case 'mv':
      case 'manavalue':
      case 'cmc':
        this.parseManaValue(value, filters);
        break;
      case 'o':
      case 'oracle':
        filters.oracleText = value.replace(/['"]/g, '');
        break;
      case 's':
      case 'set':
        if (value.includes(',') || value.includes('|')) {
          filters.sets = value.split(/[,|]/).map(s => s.trim());
        } else {
          filters.set = value;
        }
        break;
      case 'block':
      case 'b':
        filters.block = value;
        break;
      case 'a':
      case 'artist':
        filters.artist = value.replace(/['"]/g, '');
        break;
      case 'pow':
      case 'power':
        this.parsePowerToughness(value, filters, 'power');
        break;
      case 'tou':
      case 'toughness':
        this.parsePowerToughness(value, filters, 'toughness');
        break;
      case 'loy':
      case 'loyalty':
        this.parseLoyalty(value, filters);
        break;
      case 'usd':
      case 'price':
        this.parsePrice(value, filters);
        break;
      case 'ci':
      case 'coloridentity':
      case 'id':
        this.parseColorIdentity(value, filters);
        break;
      case 'k':
      case 'keyword':
      case 'kw':
        this.parseKeywords(value, filters);
        break;
      case 'produces':
      case 'mana':
        this.parseProduces(value, filters);
        break;
      case 'year':
      case 'y':
        this.parseYear(value, filters);
        break;
      case 'layout':
        filters.layout = value;
        break;
      case 'frame':
        filters.frame = value;
        break;
      case 'frameeffects':
      case 'fe':
        this.parseFrameEffects(value, filters);
        break;
      case 'watermark':
      case 'wm':
        filters.watermark = value;
        break;
      case 'lang':
      case 'language':
        filters.language = value;
        break;
      case 'game':
        filters.game = value;
        break;
      case 'cube':
        filters.cube = value;
        break;
      case 'is':
        this.parseIs(value, filters);
        break;
      case 'not':
        this.parseNot(value, filters);
        break;
    }
  }

  private static parseColors(value: string, filters: SearchFilters): void {
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

  private static parseSubtypes(value: string, filters: SearchFilters): void {
    const subtypes = value.split(/[,|]/).map(t => t.trim().toLowerCase());
    filters.subtypes = subtypes;
  }

  private static parseSupertypes(value: string, filters: SearchFilters): void {
    const supertypes = value.split(/[,|]/).map(t => t.trim().toLowerCase());
    filters.supertypes = supertypes;
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
    const match = value.match(/^([><=]+)?(\d+)$/);
    if (!match) return;

    const [, operator, numberStr] = match;
    const number = parseInt(numberStr);

    if (operator === '>=' || operator === '>') {
      filters.minMv = number;
    } else if (operator === '<=' || operator === '<') {
      filters.maxMv = number;
    } else {
      filters.minMv = number;
      filters.maxMv = number;
    }
  }

  private static parsePowerToughness(value: string, filters: SearchFilters, type: 'power' | 'toughness'): void {
    if (value === '*' || value === 'X') {
      if (type === 'power') filters.power = value;
      else filters.toughness = value;
      return;
    }

    const match = value.match(/^([><=]+)?(\d+)$/);
    if (!match) {
      if (type === 'power') filters.power = value;
      else filters.toughness = value;
      return;
    }

    const [, operator, numberStr] = match;
    const number = parseInt(numberStr);

    if (type === 'power') {
      if (operator === '>=' || operator === '>') {
        filters.minPower = number;
      } else if (operator === '<=' || operator === '<') {
        filters.maxPower = number;
      } else {
        filters.minPower = number;
        filters.maxPower = number;
      }
    } else {
      if (operator === '>=' || operator === '>') {
        filters.minToughness = number;
      } else if (operator === '<=' || operator === '<') {
        filters.maxToughness = number;
      } else {
        filters.minToughness = number;
        filters.maxToughness = number;
      }
    }
  }

  private static parseLoyalty(value: string, filters: SearchFilters): void {
    const match = value.match(/^([><=]+)?(\d+)$/);
    if (!match) {
      filters.loyalty = value;
      return;
    }

    const [, operator, numberStr] = match;
    const number = parseInt(numberStr);

    if (operator === '>=' || operator === '>') {
      filters.minLoyalty = number;
    } else if (operator === '<=' || operator === '<') {
      filters.maxLoyalty = number;
    } else {
      filters.minLoyalty = number;
      filters.maxLoyalty = number;
    }
  }

  private static parseYear(value: string, filters: SearchFilters): void {
    const match = value.match(/^([><=]+)?(\d{4})$/);
    if (!match) return;

    const [, operator, yearStr] = match;
    const year = parseInt(yearStr);

    if (operator === '>=' || operator === '>') {
      filters.minYear = year;
    } else if (operator === '<=' || operator === '<') {
      filters.maxYear = year;
    } else {
      filters.year = year;
    }
  }

  private static parseFrameEffects(value: string, filters: SearchFilters): void {
    const effects = value.split(/[,|]/).map(e => e.trim());
    filters.frameEffects = effects;
  }

  private static parseIs(value: string, filters: SearchFilters): void {
    const isValues = value.split(/[,|]/).map(v => v.trim().toLowerCase());
    filters.is = (filters.is || []).concat(isValues);
    
    if (isValues.includes('colorless')) filters.colorless = true;
    if (isValues.includes('monocolor') || isValues.includes('monocolored')) filters.monocolor = true;
    if (isValues.includes('multicolor') || isValues.includes('multicolored')) filters.multicolor = true;
  }

  private static parseNot(value: string, filters: SearchFilters): void {
    const notValues = value.split(/[,|]/).map(v => v.trim().toLowerCase());
    filters.not = (filters.not || []).concat(notValues);
  }

  private static parseKeywords(value: string, filters: SearchFilters): void {
    const keywords = value.split(/[,|]/).map(k => k.trim());
    filters.keywords = (filters.keywords || []).concat(keywords);
  }

  private static parseProduces(value: string, filters: SearchFilters): void {
    const produces = value.split(/[,|]/).map(p => p.trim());
    filters.produces = (filters.produces || []).concat(produces);
  }

  private static parseColorIdentity(value: string, filters: SearchFilters): void {
    const operatorMatch = value.match(/^([<>=]+)?(.*)$/);
    if (!operatorMatch) return;

    const [, operator, colors] = operatorMatch;
    const colorArray: string[] = [];
    
    for (const char of colors.toLowerCase()) {
      const color = this.colorMap[char];
      if (color && !colorArray.includes(color)) {
        colorArray.push(color);
      }
    }
    
    if (colorArray.length > 0) {
      filters.colorIdentity = colorArray;
    }
  }

  private static parsePrice(value: string, filters: SearchFilters): void {
    const rangeMatch = value.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      const [, min, max] = rangeMatch;
      filters.minPrice = parseFloat(min);
      filters.maxPrice = parseFloat(max);
      return;
    }

    const operatorMatch = value.match(/^([><=]+)?(\d+(?:\.\d+)?)$/);
    if (!operatorMatch) return;

    const [, operator, numberStr] = operatorMatch;
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
}