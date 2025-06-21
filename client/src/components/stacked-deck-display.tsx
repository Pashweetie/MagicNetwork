import { useState, useMemo } from "react";
import { Card } from "@shared/schema";
import { DeckEntry } from "@/hooks/use-deck";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Crown } from "lucide-react";

type SortOption = 'name' | 'name_desc' | 'mana_value' | 'price' | 'type';
type CategoryOption = 'type' | 'mana_value' | 'none';

interface StackedDeckDisplayProps {
  deckEntries: DeckEntry[];
  onAdd: (card: Card) => void;
  onRemove: (cardId: string) => void;
  onClick: (card: Card) => void;
  onSetCommander?: (card: Card) => void;
  commander?: Card | null;
  getMaxCopies: (card: Card) => number;
  viewMode: 'grid' | 'list';
}

interface CategoryGroup {
  name: string;
  cards: DeckEntry[];
  totalQuantity: number;
  isExpanded: boolean;
}

const getCardPrice = (card: Card): number => {
  const price = card.prices?.usd;
  return price ? parseFloat(price) : 0;
};

const getCardTypeCategory = (card: Card): string => {
  const typeLine = card.type_line?.toLowerCase() || '';
  
  if (typeLine.includes('land')) return 'Lands';
  if (typeLine.includes('creature')) return 'Creatures';
  if (typeLine.includes('instant')) return 'Instants';
  if (typeLine.includes('sorcery')) return 'Sorceries';
  if (typeLine.includes('enchantment')) return 'Enchantments';
  if (typeLine.includes('artifact')) return 'Artifacts';
  if (typeLine.includes('planeswalker')) return 'Planeswalkers';
  if (typeLine.includes('battle')) return 'Battles';
  
  return 'Other';
};

const getManaValueCategory = (card: Card): string => {
  const cmc = card.cmc || 0;
  
  if (cmc === 0) return '0 Mana';
  if (cmc === 1) return '1 Mana';
  if (cmc === 2) return '2 Mana';
  if (cmc === 3) return '3 Mana';
  if (cmc === 4) return '4 Mana';
  if (cmc === 5) return '5 Mana';
  if (cmc === 6) return '6 Mana';
  if (cmc >= 7) return '7+ Mana';
  
  return 'Unknown';
};

const sortCards = (cards: DeckEntry[], sortBy: SortOption): DeckEntry[] => {
  return [...cards].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.card.name.localeCompare(b.card.name);
      case 'name_desc':
        return b.card.name.localeCompare(a.card.name);
      case 'mana_value':
        return (a.card.cmc || 0) - (b.card.cmc || 0);
      case 'price':
        return getCardPrice(b.card) - getCardPrice(a.card);
      case 'type':
        return a.card.type_line?.localeCompare(b.card.type_line || '') || 0;
      default:
        return 0;
    }
  });
};



interface VerticalStackedCardsProps {
  cards: DeckEntry[];
  onAdd: (card: Card) => void;
  onRemove: (cardId: string) => void;
  onClick: (card: Card) => void;
  onSetCommander?: (card: Card) => void;
  commander?: Card | null;
  canBeCommander: (card: Card) => boolean;
  getMaxCopies: (card: Card) => number;
  viewMode: 'grid' | 'list';
}

function VerticalStackedCards({
  cards,
  onAdd,
  onRemove,
  onClick,
  onSetCommander,
  commander,
  canBeCommander,
  getMaxCopies,
  viewMode
}: VerticalStackedCardsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (viewMode === 'list') {
    return (
      <div className="space-y-1">
        {cards.map((entry) => (
          <CompactCard
            key={entry.card.id}
            entry={entry}
            onAdd={onAdd}
            onRemove={onRemove}
            onClick={onClick}
            onSetCommander={onSetCommander}
            isCommander={commander?.id === entry.card.id}
            canBeCommander={canBeCommander(entry.card)}
            maxCopies={getMaxCopies(entry.card)}
          />
        ))}
      </div>
    );
  }

  // Reversed image stack - bottom card on top, hover pushes cards above down
  const TITLE_HEIGHT = 40;
  const EXPANDED_CARD_HEIGHT = 280;
  const EXPANSION_SPACE = EXPANDED_CARD_HEIGHT - TITLE_HEIGHT;

  const calculatePositions = () => {
    return cards.map((_, index) => {
      // Base position: stack cards with just title showing
      let baseY = index * TITLE_HEIGHT;
      
      // If a card below this one is hovered, push this card down
      if (hoveredIndex !== null && index < hoveredIndex) {
        baseY += EXPANSION_SPACE;
      }
      
      return baseY;
    });
  };

  const positions = calculatePositions();
  const totalHeight = cards.length * TITLE_HEIGHT + (hoveredIndex !== null ? EXPANSION_SPACE : 0);

  return (
    <div className="relative" style={{ height: totalHeight, minHeight: '200px' }}>
      {cards.map((entry, index) => {
        const isHovered = hoveredIndex === index;
        const translateY = positions[index];
        // Reverse z-index: last card (bottom of array) appears on top
        const zIndex = isHovered ? 1000 : (cards.length - index);

        return (
          <div
            key={entry.card.id}
            className="absolute transition-all duration-300 ease-out group"
            style={{
              transform: `translateY(${translateY}px)`,
              zIndex: zIndex,
              width: '200px',
              height: isHovered ? EXPANDED_CARD_HEIGHT : TITLE_HEIGHT
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <ReversedStackCard
              entry={entry}
              onAdd={onAdd}
              onRemove={onRemove}
              onClick={onClick}
              onSetCommander={onSetCommander}
              isCommander={commander?.id === entry.card.id}
              canBeCommander={canBeCommander(entry.card)}
              maxCopies={getMaxCopies(entry.card)}
              isExpanded={isHovered}
            />
          </div>
        );
      })}
    </div>
  );
}

interface CompactCardProps {
  entry: DeckEntry;
  onAdd: (card: Card) => void;
  onRemove: (cardId: string) => void;
  onClick: (card: Card) => void;
  onSetCommander?: (card: Card) => void;
  isCommander: boolean;
  canBeCommander: boolean;
  maxCopies: number;
}

function CompactCard({
  entry,
  onAdd,
  onRemove,
  onClick,
  onSetCommander,
  isCommander,
  canBeCommander,
  maxCopies
}: CompactCardProps) {
  const { card, quantity } = entry;
  const canAddCard = quantity < maxCopies;
  const canRemoveCard = quantity > 0;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative bg-slate-700 border border-slate-600 rounded px-2 py-1 cursor-pointer transition-all duration-200 hover:bg-slate-600"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(card)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {quantity > 1 && (
            <Badge variant="secondary" className="text-xs bg-slate-600 text-white flex-shrink-0">
              {quantity}
            </Badge>
          )}
          <span className="text-sm font-medium text-white truncate">
            {card.name}
          </span>
          {isCommander && (
            <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />
          )}
        </div>
        
        {card.mana_cost && (
          <span className="text-xs font-mono text-slate-400 flex-shrink-0 ml-2">
            {card.mana_cost}
          </span>
        )}
      </div>

      {/* Hover Controls */}
      {isHovered && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1 bg-slate-800 rounded px-1 py-1 border border-slate-500 shadow-lg z-10">
          {onSetCommander && canBeCommander && (
            <Button
              size="sm"
              variant={isCommander ? "default" : "secondary"}
              className={`w-6 h-6 p-0 text-xs ${
                isCommander ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-slate-600 hover:bg-slate-500'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSetCommander(card);
              }}
            >
              <Crown className="w-3 h-3" />
            </Button>
          )}
          
          <Button
            size="sm"
            variant="destructive"
            className="w-6 h-6 p-0 bg-red-600 hover:bg-red-700"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(card.id);
            }}
            disabled={!canRemoveCard}
          >
            <Minus className="w-3 h-3" />
          </Button>
          
          <Button
            size="sm"
            variant="default"
            className="w-6 h-6 p-0 bg-green-600 hover:bg-green-700"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(card);
            }}
            disabled={!canAddCard}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface ImageStackedCardProps {
  entry: DeckEntry;
  onAdd: (card: Card) => void;
  onRemove: (cardId: string) => void;
  onClick: (card: Card) => void;
  onSetCommander?: (card: Card) => void;
  isCommander: boolean;
  canBeCommander: boolean;
  maxCopies: number;
}

interface ReversedStackCardProps {
  entry: DeckEntry;
  onAdd: (card: Card) => void;
  onRemove: (cardId: string) => void;
  onClick: (card: Card) => void;
  onSetCommander?: (card: Card) => void;
  isCommander: boolean;
  canBeCommander: boolean;
  maxCopies: number;
  isExpanded: boolean;
}

function ReversedStackCard({
  entry,
  onAdd,
  onRemove,
  onClick,
  onSetCommander,
  isCommander,
  canBeCommander,
  maxCopies,
  isExpanded
}: ReversedStackCardProps) {
  const { card, quantity } = entry;
  const canAddCard = quantity < maxCopies;
  const canRemoveCard = quantity > 0;

  return (
    <div className="relative h-full w-full cursor-pointer" onClick={() => onClick(card)}>
      <div className="relative h-full rounded-lg overflow-hidden shadow-lg">
        {/* Card Image - always show */}
        {card.image_uris?.normal ? (
          <img
            src={card.image_uris.normal}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-800 rounded-lg">
            <span className="text-sm text-center p-2">{card.name}</span>
          </div>
        )}

        {/* Badges overlay - always visible */}
        <div className="absolute top-2 left-2 flex gap-2">
          {quantity > 1 && (
            <Badge variant="secondary" className="bg-black/80 text-white border-slate-600">
              {quantity}x
            </Badge>
          )}
          {isCommander && (
            <div className="bg-yellow-600 rounded-full p-1">
              <Crown className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Controls - only show when expanded */}
        {isExpanded && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {onSetCommander && canBeCommander && (
              <Button
                size="sm"
                variant={isCommander ? "default" : "secondary"}
                className={`w-8 h-8 p-0 shadow-lg ${
                  isCommander ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-slate-600 hover:bg-slate-500'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetCommander(card);
                }}
              >
                <Crown className="w-3 h-3" />
              </Button>
            )}
            
            <Button
              size="sm"
              variant="destructive"
              className="w-8 h-8 p-0 bg-red-600 hover:bg-red-700 shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(card.id);
              }}
              disabled={!canRemoveCard}
            >
              <Minus className="w-3 h-3" />
            </Button>
            
            <Button
              size="sm"
              variant="default"
              className="w-8 h-8 p-0 bg-green-600 hover:bg-green-700 shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                onAdd(card);
              }}
              disabled={!canAddCard}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function StackedDeckDisplay({
  deckEntries,
  onAdd,
  onRemove,
  onClick,
  onSetCommander,
  commander,
  getMaxCopies,
  viewMode
}: StackedDeckDisplayProps) {
  const [sortBy, setSortBy] = useState<SortOption>('type');
  const [categoryBy, setCategoryBy] = useState<CategoryOption>('type');

  // All categories are always expanded in the new horizontal layout

  const categorizedCards = useMemo((): CategoryGroup[] => {
    if (categoryBy === 'none') {
      const sorted = sortCards(deckEntries, sortBy);
      return [{
        name: 'All Cards',
        cards: sorted,
        totalQuantity: sorted.reduce((sum, entry) => sum + entry.quantity, 0),
        isExpanded: true
      }];
    }

    const groups = new Map<string, DeckEntry[]>();
    
    deckEntries.forEach(entry => {
      const category = categoryBy === 'type' 
        ? getCardTypeCategory(entry.card)
        : getManaValueCategory(entry.card);
      
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(entry);
    });

    const categoryOrder = categoryBy === 'type'
      ? ['Creatures', 'Planeswalkers', 'Instants', 'Sorceries', 'Enchantments', 'Artifacts', 'Lands', 'Other', 'Battles']
      : ['0 Mana', '1 Mana', '2 Mana', '3 Mana', '4 Mana', '5 Mana', '6 Mana', '7+ Mana', 'Unknown'];

    return categoryOrder
      .filter(category => groups.has(category))
      .map(category => {
        const cards = sortCards(groups.get(category)!, sortBy);
        return {
          name: category,
          cards,
          totalQuantity: cards.reduce((sum, entry) => sum + entry.quantity, 0),
          isExpanded: true
        };
      });
  }, [deckEntries, sortBy, categoryBy]);

  const canBeCommander = (card: Card) => {
    const typeLine = card.type_line?.toLowerCase() || '';
    const isLegendary = typeLine.includes('legendary');
    const isCreature = typeLine.includes('creature');
    const isPlaneswalker = typeLine.includes('planeswalker');
    return isLegendary && (isCreature || isPlaneswalker);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 p-4 bg-slate-800 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Sort by:</span>
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="name_desc">Name Z-A</SelectItem>
                <SelectItem value="mana_value">Mana Value</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Group by:</span>
            <Select value={categoryBy} onValueChange={(value: CategoryOption) => setCategoryBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="type">Card Type</SelectItem>
                <SelectItem value="mana_value">Mana Value</SelectItem>
                <SelectItem value="none">No Grouping</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-sm text-slate-400">
          Total: {deckEntries.reduce((sum, entry) => sum + entry.quantity, 0)} cards
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto">
        {categorizedCards.map(category => (
          <div key={category.name} className="flex-shrink-0 w-64 space-y-2">
            {/* Category Header */}
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-600">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-white">{category.name}</h3>
                <Badge variant="secondary" className="text-xs bg-slate-600 text-slate-300">
                  Qty: {category.totalQuantity}
                </Badge>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Price: ${category.cards.reduce((sum, entry) => sum + (getCardPrice(entry.card) * entry.quantity), 0).toFixed(2)}
              </div>
            </div>
            
            {/* Vertical Card Stack */}
            <div className="space-y-1 max-h-96 overflow-y-auto">
              <VerticalStackedCards
                cards={category.cards}
                onAdd={onAdd}
                onRemove={onRemove}
                onClick={onClick}
                onSetCommander={onSetCommander}
                commander={commander}
                canBeCommander={canBeCommander}
                getMaxCopies={getMaxCopies}
                viewMode={viewMode}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}