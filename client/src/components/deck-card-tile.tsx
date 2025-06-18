import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Crown } from "lucide-react";

interface DeckCardTileProps {
  card: Card;
  quantity: number;
  maxCopies: number;
  onAdd: () => void;
  onRemove: () => void;
  onClick: (card: Card) => void;
  onSetCommander?: (card: Card) => void;
  isCommander?: boolean;
  showControls?: boolean;
}

export function DeckCardTile({ 
  card, 
  quantity, 
  maxCopies, 
  onAdd, 
  onRemove, 
  onClick,
  onSetCommander,
  isCommander = false,
  showControls = true 
}: DeckCardTileProps) {
  const canAdd = quantity < maxCopies;
  const canRemove = quantity > 0;
  
  const canBeCommander = () => {
    const typeLine = card.type_line?.toLowerCase() || '';
    const isLegendary = typeLine.includes('legendary');
    const isCreature = typeLine.includes('creature');
    const isPlaneswalker = typeLine.includes('planeswalker');
    return isLegendary && (isCreature || isPlaneswalker);
  };

  return (
    <div className="relative group">
      <div 
        className="aspect-[2.5/3.5] bg-slate-700 rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-110 hover:z-20"
        onClick={() => onClick(card)}
      >
        {card.image_uris?.small ? (
          <img
            src={card.image_uris.small}
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
      {onSetCommander && canBeCommander() && (
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
        <div className="absolute bottom-2 right-2 flex space-x-1 z-20">
          {quantity > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 border-0"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove();
              }}
              disabled={!canRemove}
            >
              <Minus className="w-2.5 h-2.5" />
            </Button>
          )}
          
          <Button
            size="sm"
            variant={quantity > 0 ? "secondary" : "default"}
            className={`w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity border-0 ${
              quantity > 0 ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
            } ${!canAdd ? "opacity-50" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onAdd();
            }}
            disabled={!canAdd}
          >
            <Plus className="w-2.5 h-2.5" />
          </Button>
        </div>
      )}

      {/* Max copies indicator */}
      {showControls && quantity === maxCopies && maxCopies < 999 && (
        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
          <Badge variant="outline" className="text-xs bg-slate-800 text-slate-300 border-slate-600">
            Max
          </Badge>
        </div>
      )}

      {/* Card name overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-xs text-white font-medium truncate">{card.name}</p>
        <p className="text-xs text-slate-300">{card.type_line}</p>
        {quantity > 0 && (
          <p className="text-xs text-slate-400">
            {quantity}/{maxCopies === 999 ? "∞" : maxCopies}
          </p>
        )}
      </div>
    </div>
  );
}