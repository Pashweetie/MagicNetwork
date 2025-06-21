import { useState } from 'react';
import { Card } from '@shared/schema';
import { CachedImage } from '@/components/cached-image';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface DualFacedCardProps {
  card: Card;
  className?: string;
  showFlipButton?: boolean;
}

export function DualFacedCard({ card, className = "", showFlipButton = true }: DualFacedCardProps) {
  const [currentFace, setCurrentFace] = useState(0);
  
  // Check if card has multiple faces
  const hasDualFaces = card.card_faces && card.card_faces.length >= 2;
  
  if (!hasDualFaces) {
    // Regular single-faced card
    const imageUrl = card.image_uris?.normal || card.image_uris?.small;
    return imageUrl ? (
      <CachedImage
        src={imageUrl}
        alt={card.name}
        className={className}
      />
    ) : null;
  }
  
  // Dual-faced card logic
  const faces = card.card_faces;
  const activeFace = faces[currentFace];
  const imageUrl = activeFace?.image_uris?.normal || activeFace?.image_uris?.small;
  
  const flipCard = () => {
    setCurrentFace(prev => (prev + 1) % faces.length);
  };
  
  return (
    <div className="relative group">
      {imageUrl && (
        <CachedImage
          src={imageUrl}
          alt={activeFace?.name || card.name}
          className={`${className} transition-transform duration-300`}
        />
      )}
      
      {showFlipButton && faces.length > 1 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={flipCard}
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Flip
        </Button>
      )}
      
      {faces.length > 1 && (
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
        <CachedImage
          src={imageUrl}
          alt={card.name}
          className="max-w-full max-h-96 object-contain"
        />
      </div>
    ) : null;
  }
  
  const faces = card.card_faces;
  
  return (
    <div className="space-y-4">
      {/* Show both faces side by side for modal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {faces.map((face, index) => {
          const imageUrl = face.image_uris?.large || face.image_uris?.normal;
          return imageUrl ? (
            <div key={index} className="space-y-2">
              <h4 className="font-medium text-center">{face.name}</h4>
              <CachedImage
                src={imageUrl}
                alt={face.name}
                className="w-full max-h-64 object-contain"
              />
              <div className="text-sm text-muted-foreground">
                <p><strong>Type:</strong> {face.type_line}</p>
                {face.oracle_text && (
                  <p><strong>Text:</strong> {face.oracle_text}</p>
                )}
              </div>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}