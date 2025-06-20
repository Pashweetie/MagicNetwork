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
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}