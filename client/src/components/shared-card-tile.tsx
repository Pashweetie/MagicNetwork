import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Crown } from "lucide-react";
import { CardUtils, COLOR_MAPPING } from "@shared/utils/card-utils";

interface BaseCardTileProps {
  card: Card;
  onClick: (card: Card) => void;
}

interface SearchCardTileProps extends BaseCardTileProps {
  variant: 'search';
}

interface DeckCardTileProps extends BaseCardTileProps {
  variant: 'deck';
  quantity: number;
  maxCopies: number;
  onAdd: () => void;
  onRemove: () => void;
  onSetCommander?: (card: Card) => void;
  isCommander?: boolean;
  showControls?: boolean;
}

type SharedCardTileProps = SearchCardTileProps | DeckCardTileProps;

export function SharedCardTile(props: SharedCardTileProps) {
  const { card, onClick, variant } = props;

  if (!CardUtils.isValidCard(card)) {
    console.warn('SharedCardTile received invalid card:', card);
    return null;
  }

  const cardImage = CardUtils.getCardImage(card);
  const price = CardUtils.getPrice(card);

  if (variant === 'search') {
    return <SearchVariant card={card} onClick={onClick} cardImage={cardImage} price={price} />;
  }

  return <DeckVariant {...(props as DeckCardTileProps)} cardImage={cardImage} />;
}

function SearchVariant({ 
  card, 
  onClick, 
  cardImage, 
  price 
}: { 
  card: Card; 
  onClick: (card: Card) => void; 
  cardImage: string | null; 
  price: string | null; 
}) {
  return (
    <div 
      className="group cursor-pointer transform hover:scale-110 hover:z-20 transition-transform duration-200"
      onClick={() => onClick(card)}
    >
      <div className="bg-slate-800 rounded-lg overflow-hidden shadow-lg border border-slate-700 hover:border-slate-500">
        <div className="aspect-[3/4] relative">
          {cardImage ? (
            <img
              src={cardImage}
              alt={card.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-slate-600 flex items-center justify-center">
              <span className="text-slate-400 text-sm">No Image</span>
            </div>
          )}
          {/* Price overlay in corner */}
          {price && (
            <div className="absolute top-2 right-2 bg-black/75 text-green-400 text-xs px-2 py-1 rounded font-medium">
              {price}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeckVariant({ 
  card, 
  onClick, 
  quantity, 
  maxCopies, 
  onAdd, 
  onRemove, 
  onSetCommander,
  isCommander = false,
  showControls = true,
  cardImage 
}: DeckCardTileProps & { cardImage: string | null }) {
  const canAdd = quantity < maxCopies;
  const canRemove = quantity > 0;
  const canBeCommander = CardUtils.canBeCommander(card);

  return (
    <div className="relative group">
      <div 
        className="aspect-[2.5/3.5] bg-slate-700 rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-110 hover:z-20"
        onClick={() => onClick(card)}
      >
        {cardImage ? (
          <img
            src={cardImage}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = 'none';
              const parent = img.parentElement;
              if (parent) {
                parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-slate-400 bg-slate-800"><span class="text-xs text-center p-2">${card.name}</span></div>`;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <span className="text-xs text-center p-2">{card.name}</span>
          </div>
        )}
      </div>

      {/* Quantity Badge */}
      {quantity > 0 && (
        <Badge 
          variant="secondary" 
          className="absolute top-2 right-2 bg-slate-800 text-white border-slate-600 z-20"
        >
          {quantity}x
        </Badge>
      )}

      {/* Commander Crown */}
      {onSetCommander && canBeCommander && (
        <Button
          size="sm"
          variant={isCommander ? "default" : "secondary"}
          className={`absolute top-2 left-2 z-20 w-7 h-7 p-0 ${
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

      {/* Add/Remove Controls */}
      {showControls && (
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <Button
            size="sm"
            variant="secondary"
            className="w-6 h-6 p-0 bg-slate-600 hover:bg-slate-500"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            disabled={!canRemove}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="w-6 h-6 p-0 bg-slate-600 hover:bg-slate-500"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            disabled={!canAdd}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Legacy component exports for backward compatibility
export function CardTile({ card, onClick }: { card: Card; onClick: (card: Card) => void }) {
  return <SharedCardTile variant="search" card={card} onClick={onClick} />;
}

export function DeckCardTile(props: Omit<DeckCardTileProps, 'variant'>) {
  return <SharedCardTile variant="deck" {...props} />;
}