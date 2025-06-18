import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus } from "lucide-react";

interface DeckCardTileProps {
  card: Card;
  quantity: number;
  maxCopies: number;
  onAdd: () => void;
  onRemove: () => void;
  onClick: (card: Card) => void;
  showControls?: boolean;
}

export function DeckCardTile({ 
  card, 
  quantity, 
  maxCopies, 
  onAdd, 
  onRemove, 
  onClick,
  showControls = true 
}: DeckCardTileProps) {
  const canAdd = quantity < maxCopies;
  const canRemove = quantity > 0;

  return (
    <div className="relative group">
      <div 
        className="aspect-[2.5/3.5] bg-slate-700 rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-105"
        onClick={() => onClick(card)}
      >
        {card.image_uris?.small ? (
          <img
            src={card.image_uris.small}
            alt={card.name}
            className="w-full h-full object-cover"
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
          className="absolute top-2 left-2 bg-slate-800 text-white border-slate-600"
        >
          {quantity}x
        </Badge>
      )}

      {/* Add/Remove Controls */}
      {showControls && (
        <div className="absolute bottom-2 right-2 flex space-x-1">
          {quantity > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              disabled={!canRemove}
            >
              <Minus className="w-3 h-3" />
            </Button>
          )}
          
          <Button
            size="sm"
            variant={quantity > 0 ? "secondary" : "default"}
            className={`w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
              !canAdd ? "opacity-50" : ""
            }`}
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

      {/* Max copies indicator */}
      {showControls && quantity === maxCopies && maxCopies < 999 && (
        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Badge variant="outline" className="text-xs bg-slate-800 text-slate-300 border-slate-600">
            Max
          </Badge>
        </div>
      )}

      {/* Card name overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
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