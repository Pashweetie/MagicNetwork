import type { Card } from "@shared/schema";

export interface FilterOptions {
  query?: string;
  colors?: string[];
  colorIdentity?: string[];
  types?: string[];
  rarities?: string[];
  format?: string;
  minMv?: number;
  maxMv?: number;
  cmc?: number;
  type?: string;
  subtype?: string;
  set?: string;
  rarity?: string;
  power?: number;
  toughness?: number;
  oracleText?: string;
  includeMulticolored?: boolean;
  colorMode?: 'exact' | 'includes';
}

/**
 * Centralized card filtering function used by search and all recommendation systems
 * Based on the working search filtering logic from routes.ts
 */
export function cardMatchesFilters(card: Card, filters?: FilterOptions): boolean {
  if (!filters) return true;
  
  try {
    // Parse query-based filters (like "id<=R" for commander color identity)
    if (filters.query && typeof filters.query === 'string') {
      const colorIdentityMatch = filters.query.match(/id<=([WUBRG]+)/);
      if (colorIdentityMatch) {
        const allowedColors = colorIdentityMatch[1].split('');
        const cardColorIdentity = card.color_identity || [];
        
        const isValidIdentity = cardColorIdentity.every((color: string) => 
          allowedColors.includes(color)
        );
        
        if (!isValidIdentity) {
          return false;
        }
      }
    }

    // Filter by colors (including color identity) - copied from working search logic
    if (filters.colors && filters.colors.length > 0) {
      const cardColors = card.colors || [];
      const cardColorIdentity = card.color_identity || [];
      
      // Check if card matches color filters
      const hasMatchingColor = filters.colors.some((filterColor: string) => {
        // Handle single letter color codes and full names
        const colorCode = filterColor.toUpperCase();
        const colorName = filterColor.toLowerCase();
        
        return cardColors.includes(colorCode) || 
               cardColorIdentity.includes(colorCode) ||
               cardColors.some(c => c.toLowerCase() === colorName) ||
               cardColorIdentity.some(c => c.toLowerCase() === colorName);
      });
      
      if (!hasMatchingColor) return false;
    }
    
    // Filter by color identity (commander constraint) - copied from working search logic
    if (filters.colorIdentity && filters.colorIdentity.length > 0) {
      const cardIdentity = card.color_identity || [];
      // Card's color identity must be subset of allowed colors (commander colors)
      if (!cardIdentity.every((color: string) => filters.colorIdentity!.includes(color))) {
        return false;
      }
    }
    
    // Filter by types - copied from working search logic
    if (filters.types && filters.types.length > 0) {
      const cardTypes = card.type_line.toLowerCase();
      if (!filters.types.some((type: string) => cardTypes.includes(type.toLowerCase()))) {
        return false;
      }
    }

    // Single type filter
    if (filters.type) {
      if (!card.type_line?.toLowerCase().includes(filters.type.toLowerCase())) {
        return false;
      }
    }

    // Subtype filtering
    if (filters.subtype) {
      if (!card.type_line?.toLowerCase().includes(filters.subtype.toLowerCase())) {
        return false;
      }
    }

    // Filter by mana value range - copied from working search logic
    if (filters.minMv !== undefined && card.cmc < filters.minMv) {
      return false;
    }
    if (filters.maxMv !== undefined && card.cmc > filters.maxMv) {
      return false;
    }

    // Exact CMC filter
    if (filters.cmc !== undefined && card.cmc !== filters.cmc) return false;

    // Filter by format legality - copied from working search logic
    if (filters.format && filters.format !== 'all') {
      const legalities = card.legalities || {};
      if (legalities[filters.format] !== 'legal') {
        return false;
      }
    }

    // Filter by rarity - copied from working search logic
    if (filters.rarities && filters.rarities.length > 0) {
      if (!filters.rarities.includes(card.rarity)) {
        return false;
      }
    }

    if (filters.rarity && filters.rarity !== 'all') {
      if (card.rarity !== filters.rarity) return false;
    }

    // Set filtering
    if (filters.set) {
      if (card.set !== filters.set) return false;
    }

    // Power/Toughness filtering
    if (filters.power !== undefined) {
      const cardPower = card.power ? parseInt(card.power) : undefined;
      if (cardPower !== filters.power) return false;
    }
    if (filters.toughness !== undefined) {
      const cardToughness = card.toughness ? parseInt(card.toughness) : undefined;
      if (cardToughness !== filters.toughness) return false;
    }

    // Oracle text search
    if (filters.oracleText) {
      if (!card.oracle_text?.toLowerCase().includes(filters.oracleText.toLowerCase())) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking card filters:', error);
    return true; // Default to including the card if there's an error
  }
}