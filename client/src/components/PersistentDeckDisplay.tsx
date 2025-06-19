import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { DeckCardTile } from "@/components/deck-card-tile";
import { Crown, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeckEntry {
  card: Card;
  quantity: number;
}

export function PersistentDeckDisplay() {
  const { data: deckData, isLoading } = useQuery({
    queryKey: ['/api/user/deck'],
    queryFn: async () => {
      const response = await fetch('/api/user/deck');
      if (!response.ok) throw new Error('Failed to fetch deck');
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
        <p>Loading deck...</p>
      </div>
    );
  }

  if (!deckData || !deckData.entries || deckData.entries.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
        <p>No cards in deck</p>
        <p className="text-sm mt-1">Use the import button or search to add cards</p>
      </div>
    );
  }

  const totalCards = deckData.entries.reduce((sum: number, entry: DeckEntry) => sum + entry.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium">Current Deck</span>
          <Badge variant="secondary">{totalCards} cards</Badge>
        </div>
        {deckData.commander && (
          <div className="flex items-center text-sm text-slate-400">
            <Crown className="w-4 h-4 mr-1 text-yellow-400" />
            <span>Commander: {deckData.commander.name}</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 max-h-64 overflow-y-auto">
        {deckData.entries.map((entry: DeckEntry) => (
          <DeckCardTile
            key={entry.card.id}
            card={entry.card}
            quantity={entry.quantity}
            maxCopies={4}
            onAdd={() => {}}
            onRemove={() => {}}
            onClick={() => {}}

          />
        ))}
      </div>
    </div>
  );
}