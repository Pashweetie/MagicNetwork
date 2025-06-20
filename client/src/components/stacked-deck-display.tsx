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
}

function VerticalStackedCards({
  cards,
  onAdd,
  onRemove,
  onClick,
  onSetCommander,
  commander,
  canBeCommander,
  getMaxCopies
}: VerticalStackedCardsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const COLLAPSED_HEIGHT = 40;
  const EXPANDED_HEIGHT = 300;

  // Calculate positions with spacing for hovered card
  const calculatePositions = () => {
    let currentY = 0;
    return cards.map((_, index) => {
      const position = currentY;
      if (index === hoveredIndex) {
        currentY += EXPANDED_HEIGHT + 10; // Extra spacing for expanded card
      } else {
        currentY += COLLAPSED_HEIGHT + 2; // Minimal spacing for collapsed cards
      }
      return position;
    });
  };

  const positions = calculatePositions();
  const totalHeight = positions[positions.length - 1] + (hoveredIndex === cards.length - 1 ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT);

  return (
    <div className="relative overflow-y-auto py-4">
      <div 
        className="relative transition-all duration-300"
        style={{ 
          height: totalHeight,
          minHeight: '200px',
          width: '100%'
        }}
      >
        {cards.map((entry, index) => {
          const isHovered = hoveredIndex === index;
          const translateY = positions[index];
          const zIndex = isHovered ? 100 : index + 1;

          return (
            <VerticalStackedCard
              key={entry.card.id}
              entry={entry}
              index={index}
              translateY={translateY}
              zIndex={zIndex}
              isHovered={isHovered}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onAdd={onAdd}
              onRemove={onRemove}
              onClick={onClick}
              onSetCommander={onSetCommander}
              isCommander={commander?.id === entry.card.id}
              canBeCommander={canBeCommander(entry.card)}
              maxCopies={getMaxCopies(entry.card)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface VerticalStackedCardProps {
  entry: DeckEntry;
  index: number;
  translateY: number;
  zIndex: number;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onAdd: (card: Card) => void;
  onRemove: (cardId: string) => void;
  onClick: (card: Card) => void;
  onSetCommander?: (card: Card) => void;
  isCommander: boolean;
  canBeCommander: boolean;
  maxCopies: number;
}

function VerticalStackedCard({
  entry,
  index,
  translateY,
  zIndex,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onAdd,
  onRemove,
  onClick,
  onSetCommander,
  isCommander,
  canBeCommander,
  maxCopies
}: VerticalStackedCardProps) {
  const { card, quantity } = entry;
  const canAddCard = quantity < maxCopies;
  const canRemoveCard = quantity > 0;
  const price = getCardPrice(card);

  return (
    <div
      className="absolute transition-all duration-300 ease-out cursor-pointer w-full"
      style={{
        transform: `translateY(${translateY}px)`,
        zIndex: zIndex,
        height: isHovered ? '300px' : '40px'
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative h-full">
        {/* Card Header - always visible */}
        <div className="bg-slate-700 border border-slate-600 rounded-t-lg p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {quantity > 1 && (
              <Badge variant="secondary" className="text-xs bg-slate-600 text-white">
                {quantity}
              </Badge>
            )}
            <span className="text-sm font-medium text-white truncate">
              {card.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isCommander && (
              <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            )}
            {/* Show mana cost and type when collapsed */}
            {!isHovered && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{card.type_line?.split(' — ')[0]}</span>
                {card.mana_cost && (
                  <span className="font-mono bg-slate-600 px-1 rounded">{card.mana_cost}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card Body - expands on hover */}
        <div 
          className={`bg-slate-800 border-x border-b border-slate-600 rounded-b-lg overflow-hidden transition-all duration-300 ${
            isHovered ? 'flex-1' : 'h-0'
          }`}
          onClick={() => onClick(card)}
        >
          {isHovered && (
            <div className="h-full flex gap-4 p-4">
              {/* Card Image */}
              <div className="flex-shrink-0 w-40">
                {card.image_uris?.normal ? (
                  <img
                    src={card.image_uris.normal}
                    alt={card.name}
                    className="w-full h-auto object-cover rounded"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent) {
                        parent.innerHTML = `<div class="w-full h-32 flex items-center justify-center text-slate-400 bg-slate-700 rounded"><span class="text-sm text-center p-2">${card.name}</span></div>`;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center text-slate-400 bg-slate-700 rounded">
                    <span className="text-sm text-center p-2">{card.name}</span>
                  </div>
                )}
              </div>

              {/* Card Info */}
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-sm text-slate-300 font-medium">{card.type_line}</div>
                  {card.mana_cost && (
                    <div className="text-sm text-slate-400 font-mono mt-1">{card.mana_cost}</div>
                  )}
                </div>
                
                {card.oracle_text && (
                  <div className="text-xs text-slate-400 leading-relaxed">
                    {card.oracle_text.slice(0, 200)}{card.oracle_text.length > 200 ? '...' : ''}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  {price > 0 && (
                    <div className="text-sm text-green-400 font-medium">
                      ${price.toFixed(2)}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {onSetCommander && canBeCommander && (
                      <Button
                        size="sm"
                        variant={isCommander ? "default" : "secondary"}
                        className={`h-8 text-xs ${
                          isCommander ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetCommander(card);
                        }}
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        {isCommander ? 'Commander' : 'Set Cmdr'}
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs bg-red-600 hover:bg-red-700"
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
                      className="h-8 text-xs bg-green-600 hover:bg-green-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd(card);
                      }}
                      disabled={!canAddCard}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
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
  getMaxCopies
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

      <div className="space-y-6">
        {categorizedCards.map(category => (
          <div key={category.name} className="space-y-3">
            {/* Category Header */}
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-white">{category.name}</h3>
              <Badge variant="secondary" className="text-xs bg-slate-600 text-slate-300">
                {category.totalQuantity} cards
              </Badge>
            </div>
            
            {/* Vertical Card Stack */}
            <div className="overflow-y-auto max-h-96">
              <VerticalStackedCards
                cards={category.cards}
                onAdd={onAdd}
                onRemove={onRemove}
                onClick={onClick}
                onSetCommander={onSetCommander}
                commander={commander}
                canBeCommander={canBeCommander}
                getMaxCopies={getMaxCopies}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}