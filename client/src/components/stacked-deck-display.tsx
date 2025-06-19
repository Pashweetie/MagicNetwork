import { useState, useMemo } from "react";
import { Card } from "@shared/schema";
import { DeckEntry } from "@/hooks/use-deck";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Plus, Minus, Crown } from "lucide-react";

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Creatures', 'Lands', 'Instants', 'Sorceries']));

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
    <div className="space-y-4">
      {/* Controls */}
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

      {/* Card Categories */}
      <div className="space-y-2">
        {categorizedCards.map(category => (
          <UICard key={category.name} className="bg-slate-800 border-slate-700">
            <Collapsible
              open={category.isExpanded}
              onOpenChange={() => toggleCategory(category.name)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-slate-750 transition-colors py-3">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                      <span>{category.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {category.totalQuantity}
                      </Badge>
                    </div>
                    {category.isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {category.cards.map(entry => (
                      <StackedCardRow
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
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </UICard>
        ))}
      </div>
    </div>
  );
}

interface StackedCardRowProps {
  entry: DeckEntry;
  onAdd: (card: Card) => void;
  onRemove: (cardId: string) => void;
  onClick: (card: Card) => void;
  onSetCommander?: (card: Card) => void;
  isCommander: boolean;
  canBeCommander: boolean;
  maxCopies: number;
}

function StackedCardRow({
  entry,
  onAdd,
  onRemove,
  onClick,
  onSetCommander,
  isCommander,
  canBeCommander,
  maxCopies
}: StackedCardRowProps) {
  const { card, quantity } = entry;
  const canAdd = quantity < maxCopies;
  const canRemoveCard = quantity > 0;
  const price = getCardPrice(card);

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-750 rounded-lg hover:bg-slate-700 transition-colors group">
      {/* Card Image */}
      <div 
        className="w-12 h-16 bg-slate-600 rounded overflow-hidden cursor-pointer flex-shrink-0"
        onClick={() => onClick(card)}
      >
        {card.image_uris?.small ? (
          <img
            src={card.image_uris.small}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center p-1">
            {card.name}
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 
            className="font-medium text-white truncate cursor-pointer hover:text-blue-400 transition-colors"
            onClick={() => onClick(card)}
          >
            {card.name}
          </h4>
          {isCommander && (
            <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>{card.type_line}</span>
          <span>CMC {card.cmc || 0}</span>
          {price > 0 && <span>${price.toFixed(2)}</span>}
        </div>
      </div>

      {/* Quantity and Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant="secondary" className="text-sm min-w-[3rem] text-center">
          {quantity}x
        </Badge>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onSetCommander && canBeCommander && (
            <Button
              size="sm"
              variant={isCommander ? "default" : "secondary"}
              className={`w-8 h-8 p-0 ${
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
            className="w-8 h-8 p-0 bg-red-600 hover:bg-red-700"
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
            className="w-8 h-8 p-0 bg-green-600 hover:bg-green-700"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(card);
            }}
            disabled={!canAdd}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}