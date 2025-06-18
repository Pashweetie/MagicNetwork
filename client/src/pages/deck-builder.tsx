import { useState } from "react";
import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArchetypeAnalyzer } from "@/components/archetype-analyzer";
import { CardTile } from "@/components/card-tile";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Trash2, Brain } from "lucide-react";

export default function DeckBuilder() {
  const [deck, setDeck] = useState<Card[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['/api/cards/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return { data: [] };
      
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: searchQuery.length > 2,
  });

  const addCardToDeck = (card: Card) => {
    setDeck(prev => [...prev, card]);
  };

  const removeCardFromDeck = (cardId: string) => {
    setDeck(prev => prev.filter(card => card.id !== cardId));
  };

  const clearDeck = () => {
    setDeck([]);
  };

  const getCardCount = (cardId: string) => {
    return deck.filter(card => card.id === cardId).length;
  };

  const uniqueCards = Array.from(
    new Map(deck.map(card => [card.id, card])).values()
  );

  const totalCards = deck.length;
  const avgCmc = deck.length > 0 
    ? (deck.reduce((sum, card) => sum + card.cmc, 0) / deck.length).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AI Deck Builder</h1>
          <p className="text-slate-400">Build decks with machine learning archetype analysis</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search and Card Pool */}
          <div className="lg:col-span-1 space-y-6">
            <UICard className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="w-5 h-5" />
                  <span>Card Search</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    placeholder="Search for cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                  
                  {searchLoading && (
                    <div className="text-center py-4 text-slate-400">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                      <p className="mt-2">Searching...</p>
                    </div>
                  )}
                  
                  {searchResults && searchResults.data && (
                    <div className="max-h-96 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-2">
                        {searchResults.data.slice(0, 20).map((card: Card) => (
                          <div key={card.id} className="relative group">
                            <CardTile
                              card={card}
                              onClick={() => addCardToDeck(card)}
                            />
                            <div className="absolute top-2 right-2">
                              <Button
                                size="sm"
                                className="w-6 h-6 p-0 bg-green-600 hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addCardToDeck(card);
                                }}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </UICard>
          </div>

          {/* Deck List */}
          <div className="lg:col-span-1 space-y-6">
            <UICard className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <span>Current Deck</span>
                    <Badge variant="secondary">{totalCards} cards</Badge>
                  </CardTitle>
                  {deck.length > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={clearDeck}
                      className="flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {deck.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-700 rounded-lg flex items-center justify-center">
                      <Plus className="w-8 h-8" />
                    </div>
                    <p>No cards in deck</p>
                    <p className="text-sm mt-1">Search and add cards to start building</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>Cards: {totalCards}</span>
                      <span>Avg CMC: {avgCmc}</span>
                    </div>
                    
                    <Separator className="bg-slate-600" />
                    
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {uniqueCards.map((card) => {
                        const count = getCardCount(card.id);
                        return (
                          <div key={card.id} className="flex items-center space-x-3 p-2 bg-slate-900 rounded">
                            <div className="w-12 h-16 bg-slate-700 rounded overflow-hidden flex-shrink-0">
                              {card.image_uris?.small ? (
                                <img
                                  src={card.image_uris.small}
                                  alt={card.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                                  {card.name.substring(0, 2)}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">{card.name}</p>
                              <p className="text-xs text-slate-400">{card.type_line}</p>
                              <p className="text-xs text-slate-500">CMC: {card.cmc}</p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {count}x
                              </Badge>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeCardFromDeck(card.id)}
                                className="w-6 h-6 p-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </UICard>
          </div>

          {/* AI Analysis */}
          <div className="lg:col-span-1">
            <ArchetypeAnalyzer 
              cards={deck} 
              onSuggestCard={addCardToDeck}
            />
          </div>
        </div>
      </div>
    </div>
  );
}