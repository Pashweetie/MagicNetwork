import { useState, useMemo } from "react";
import { Card } from "@shared/schema";
import { DeckEntry } from "@/hooks/use-deck";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Plus, Minus, Crown } from "lucide-react";
import { CachedImage } from "@/components/cached-image";

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
  
  const CARD_HEIGHT = 300;
  const CARD_SPACING = 40; // Standard spacing between cards
  const HOVER_SHIFT = CARD_HEIGHT - CARD_SPACING; // How much to shift cards above when hovering

  return (
    <div className="relative overflow-y-auto py-4">
      <div 
        className="flex flex-col relative"
        style={{ 
          height: cards.length > 0 ? cards.length * CARD_SPACING + CARD_HEIGHT + (hoveredIndex !== null ? HOVER_SHIFT : 0) : 0,
          minWidth: '220px'
        }}
      >
        {cards.map((entry, index) => {
          const isHovered = hoveredIndex === index;
          
          // Calculate translateY with hover effect
          let translateY = index * CARD_SPACING;
          
          // If there's a hovered card and this card is above it, shift it down
          if (hoveredIndex !== null && index > hoveredIndex) {
            translateY += HOVER_SHIFT;
          }
          
          // Lower z-index for cards that appear earlier in the list (topmost card lowest in stack)
          const zIndex = isHovered ? 100 : (index + 1);

          return (
            <StackedCard
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

interface StackedCardProps {
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

function StackedCard({
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
}: StackedCardProps) {
  const { card, quantity } = entry;
  const canAddCard = quantity < maxCopies;
  const canRemoveCard = quantity > 0;
  const price = getCardPrice(card);

  return (
    <div
      className="absolute transition-all duration-300 ease-out cursor-pointer"
      style={{
        transform: `translateY(${translateY}px)`,
        zIndex: isHovered ? 100 : zIndex,
        width: '200px'
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative group">
        <div 
          className={`w-[200px] aspect-[2.5/3.5] bg-slate-600 rounded-lg overflow-hidden transition-all duration-300 ${
            isHovered 
              ? 'shadow-2xl shadow-blue-400/50 ring-2 ring-blue-400/50' 
              : 'shadow-lg'
          }`}
          onClick={() => onClick(card)}
        >
          <CachedImage
            src={card.image_uris?.normal}
            alt={card.name}
            className="w-full h-full object-cover"
            priority={isHovered}
          />
        </div>

        {quantity > 1 && (
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 bg-black/90 text-white border-slate-600 text-sm px-2 py-1 shadow-lg"
          >
            {quantity}x
          </Badge>
        )}

        {isCommander && (
          <div className="absolute top-2 left-2 bg-yellow-600 rounded-full p-1 shadow-lg">
            <Crown className="w-4 h-4 text-white" />
          </div>
        )}

        {price > 0 && (
          <Badge 
            variant="outline" 
            className="absolute bottom-2 left-2 bg-black/90 text-green-400 border-green-400/50 text-xs shadow-lg"
          >
            ${price.toFixed(2)}
          </Badge>
        )}

        {isHovered && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
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
  getMaxCopies
}: StackedDeckDisplayProps) {
  const [sortBy, setSortBy] = useState<SortOption>('type');
  const [categoryBy, setCategoryBy] = useState<CategoryOption>('type');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Creatures', 'Lands', 'Instants', 'Sorceries', 'Enchantments', 'Artifacts', 'Planeswalkers', 'Other', 'Battles']));


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
          isExpanded: expandedCategories.has(category)
        };
      });
  }, [deckEntries, sortBy, categoryBy, expandedCategories]);

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  const canBeCommander = (card: Card) => {
    const typeLine = card.type_line?.toLowerCase() || '';
    const isLegendary = typeLine.includes('legendary');
    const isCreature = typeLine.includes('creature');
    const isPlaneswalker = typeLine.includes('planeswalker');
    return isLegendary && (isCreature || isPlaneswalker);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4 p-2 bg-slate-800 rounded-lg">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-1">
        {categorizedCards.map((group) => (
          <Collapsible
            key={group.name}
            open={group.isExpanded}
            onOpenChange={() => toggleCategory(group.name)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-2 h-auto hover:bg-transparent"
              >
                <div className="flex items-center gap-2">
                  <div className="text-lg font-medium text-white">
                    {group.name}
                  </div>
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
                    {group.totalQuantity}
                  </Badge>
                </div>
                {group.isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                )}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <VerticalStackedCards
                cards={group.cards}
                onAdd={onAdd}
                onRemove={onRemove}
                onClick={onClick}
                onSetCommander={onSetCommander}
                commander={commander}
                canBeCommander={canBeCommander}
                getMaxCopies={getMaxCopies}
              />
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}