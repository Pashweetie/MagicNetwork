import { Card } from "@shared/schema";

interface CardTileProps {
  card: Card;
  onClick: (card: Card) => void;
}

const COLOR_MAPPING: Record<string, string> = {
  'W': 'bg-yellow-200',
  'U': 'bg-blue-500',
  'B': 'bg-gray-800',
  'R': 'bg-red-500',
  'G': 'bg-green-500',
};

export function CardTile({ card, onClick }: CardTileProps) {
  const getCardImage = () => {
    if (card.image_uris?.normal) {
      return card.image_uris.normal;
    }
    if (card.card_faces?.[0]?.image_uris?.normal) {
      return card.card_faces[0].image_uris.normal;
    }
    return null;
  };

  const getPrice = () => {
    if (card.prices?.usd) {
      return `$${card.prices.usd}`;
    }
    return null;
  };

  const getColors = () => {
    return card.colors || card.color_identity || [];
  };

  const cardImage = getCardImage();
  const price = getPrice();
  const colors = getColors();

  return (
    <div 
      className="group cursor-pointer transform hover:scale-105 transition-transform duration-200"
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
          {price && (
            <div className="absolute top-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded">
              {price}
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="text-sm font-medium text-white truncate">
            {card.name}
          </h3>
          <p className="text-xs text-slate-400 truncate">
            {card.type_line}
          </p>

        </div>
      </div>
    </div>
  );
}
