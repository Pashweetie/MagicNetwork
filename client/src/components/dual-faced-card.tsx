import { useState } from 'react';
import { Card } from '@shared/schema';
import { CardImage } from './shared/CardImage';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface DualFacedCardProps {
  card: Card;
  className?: string;
  showFlipButton?: boolean;
}

export function DualFacedCard({ card, className = "", showFlipButton = true }: DualFacedCardProps) {
  const [currentFace, setCurrentFace] = useState(0);
  
  // Debug logging for cards with missing images
  if (card.name && (card.name.toLowerCase().includes('jorn') || (!card.image_uris && !card.card_faces))) {
    console.log(`🃏 Card image debug for ${card.name}:`, {
      name: card.name,
      has_image_uris: !!card.image_uris,
      image_uris: card.image_uris,
      has_card_faces: !!card.card_faces,
      card_faces: card.card_faces,
      card_faces_length: card.card_faces?.length,
      all_keys: Object.keys(card)
    });
  }
  
  // Check if card has multiple faces - be more defensive about the data structure
  const hasDualFaces = card.card_faces && Array.isArray(card.card_faces) && card.card_faces.length >= 2;
  
  if (!hasDualFaces) {
    // Regular single-faced card
    const imageUrl = card.image_uris?.normal || card.image_uris?.small;
    return imageUrl ? (
      <CardImage
        src={imageUrl}
        alt={card.name}
        className={className}
      />
    ) : (
      <div className={`${className} bg-slate-700 flex items-center justify-center text-slate-300 text-sm p-4`}>
        {card.name}
      </div>
    );
  }
  
  // Dual-faced card logic
  const faces = card.card_faces;
  const activeFace = faces?.[currentFace];
  const imageUrl = activeFace?.image_uris?.normal || activeFace?.image_uris?.small;
  
  const flipCard = () => {
    if (faces) {
      setCurrentFace(prev => (prev + 1) % faces.length);
    }
  };
  
  return (
    <div 
      className="relative group"
      onMouseEnter={() => faces && faces.length > 1 && setCurrentFace(1)}
      onMouseLeave={() => faces && faces.length > 1 && setCurrentFace(0)}
    >
      {imageUrl ? (
        <CardImage
          src={imageUrl}
          alt={activeFace?.name || card.name}
          className={`${className} transition-all duration-300`}
        />
      ) : (
        <div className={`${className} bg-slate-700 flex items-center justify-center text-slate-300 text-sm p-4`}>
          {activeFace?.name || card.name}
        </div>
      )}
      
      {faces && faces.length > 1 && (
        <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
          {currentFace + 1} / {faces.length}
        </div>
      )}
    </div>
  );
}

export function DualFacedCardModal({ card }: { card: Card }) {
  const [currentFace, setCurrentFace] = useState(0);
  
  const hasDualFaces = card.card_faces && card.card_faces.length >= 2;
  
  if (!hasDualFaces) {
    const imageUrl = card.image_uris?.large || card.image_uris?.normal;
    return imageUrl ? (
      <div className="flex justify-center">
        <CardImage
          src={imageUrl}
          alt={card.name}
          className="max-w-full max-h-96 object-contain"
        />
      </div>
    ) : null;
  }
  
  const faces = card.card_faces;
  const activeFace = faces?.[currentFace];
  const imageUrl = activeFace?.image_uris?.large || activeFace?.image_uris?.normal;
  
  return (
    <div className="space-y-4">
      {/* Single card with hover flip for modal */}
      <div className="flex justify-center">
        <div 
          className="relative group"
          onMouseEnter={() => faces && faces.length > 1 && setCurrentFace(1)}
          onMouseLeave={() => faces && faces.length > 1 && setCurrentFace(0)}
        >
          {imageUrl ? (
            <CardImage
              src={imageUrl}
              alt={activeFace?.name || card.name}
              className="max-w-full max-h-96 object-contain transition-all duration-300"
            />
          ) : (
            <div className="max-w-full max-h-96 bg-slate-700 flex items-center justify-center text-slate-300 text-lg p-8 rounded">
              {activeFace?.name || card.name}
            </div>
          )}
          
          {faces && faces.length > 1 && (
            <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
              {currentFace + 1} / {faces.length}
            </div>
          )}
        </div>
      </div>
      
      {/* Face details */}
      <div className="text-sm text-muted-foreground">
        <h4 className="font-medium text-center mb-2">{activeFace?.name || card.name}</h4>
        <p><strong>Type:</strong> {activeFace?.type_line}</p>
        {activeFace?.oracle_text && (
          <p><strong>Text:</strong> {activeFace.oracle_text}</p>
        )}
      </div>
    </div>
  );
}