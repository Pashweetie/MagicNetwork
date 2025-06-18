import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardTile } from "@/components/card-tile";
import { DeckCardTile } from "@/components/deck-card-tile";
import { CardDetailModal } from "@/components/card-detail-modal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Save, Plus, Search, FileText, Users, Crown } from "lucide-react";

interface DeckCard {
  card: Card;
  quantity: number;
}

interface DeckData {
  id?: number;
  name: string;
  format: string;
  description?: string;
  commanderId?: string;
  cards: Array<{cardId: string, quantity: number}>;
}

export default function DeckBuilder() {
  const [deckCards, setDeckCards] = useState<Map<string, DeckCard>>(new Map());
  const [commander, setCommander] = useState<Card | null>(null);
  const [deckName, setDeckName] = useState("");
  const [deckFormat, setDeckFormat] = useState("commander");
  const [deckDescription, setDeckDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDeckId, setCurrentDeckId] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Search for cards to add to deck
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['/api/cards/search', { query: searchQuery }],
    queryFn: async () => {
      if (!searchQuery) return { cards: [] };
      const response = await fetch(`/api/cards/search?query=${encodeURIComponent(searchQuery)}&page=1`);
      return response.json();
    },
    enabled: !!searchQuery
  });

  // Load saved decks
  const { data: savedDecks } = useQuery({
    queryKey: ['/api/decks'],
    queryFn: async () => {
      const response = await fetch('/api/decks');
      return response.json();
    }
  });

  // Save deck mutation
  const saveDeckMutation = useMutation({
    mutationFn: async (deckData: DeckData) => {
      if (currentDeckId) {
        return apiRequest(`/api/decks/${currentDeckId}`, {
          method: 'PUT',
          body: JSON.stringify(deckData)
        });
      } else {
        return apiRequest('/api/decks', {
          method: 'POST',
          body: JSON.stringify(deckData)
        });
      }
    },
    onSuccess: (savedDeck) => {
      toast({
        title: "Deck Saved",
        description: `${savedDeck.name} has been saved successfully.`
      });
      setCurrentDeckId(savedDeck.id);
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save deck. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Load deck mutation
  const loadDeckMutation = useMutation({
    mutationFn: async (deckId: number) => {
      const response = await fetch(`/api/decks/${deckId}`);
      return response.json();
    },
    onSuccess: async (deck) => {
      setDeckName(deck.name);
      setDeckFormat(deck.format);
      setDeckDescription(deck.description || "");
      setCurrentDeckId(deck.id);

      // Load cards
      const cardMap = new Map<string, DeckCard>();
      for (const deckCard of deck.cards) {
        const cardResponse = await fetch(`/api/cards/${deckCard.cardId}`);
        const card = await cardResponse.json();
        if (card) {
          cardMap.set(card.id, { card, quantity: deckCard.quantity });
        }
      }
      setDeckCards(cardMap);

      // Load commander if exists
      if (deck.commanderId) {
        const commanderResponse = await fetch(`/api/cards/${deck.commanderId}`);
        const commanderCard = await commanderResponse.json();
        setCommander(commanderCard);
      }

      toast({
        title: "Deck Loaded",
        description: `${deck.name} has been loaded successfully.`
      });
    }
  });

  const addCardToDeck = (card: Card, quantity: number = 1) => {
    const newDeckCards = new Map(deckCards);
    const existing = newDeckCards.get(card.id);
    
    if (existing) {
      const maxCopies = getMaxCopies(card);
      const newQuantity = Math.min(existing.quantity + quantity, maxCopies);
      newDeckCards.set(card.id, { ...existing, quantity: newQuantity });
    } else {
      newDeckCards.set(card.id, { card, quantity });
    }
    
    setDeckCards(newDeckCards);
  };

  const removeCardFromDeck = (cardId: string) => {
    const newDeckCards = new Map(deckCards);
    const existing = newDeckCards.get(cardId);
    
    if (existing && existing.quantity > 1) {
      newDeckCards.set(cardId, { ...existing, quantity: existing.quantity - 1 });
    } else {
      newDeckCards.delete(cardId);
    }
    
    setDeckCards(newDeckCards);
  };

  const setCommander = (card: Card) => {
    if (deckFormat === 'commander') {
      setCommander(card);
    }
  };

  const getMaxCopies = (card: Card): number => {
    if (deckFormat === 'commander') {
      return card.type_line.toLowerCase().includes('basic land') ? 99 : 1;
    }
    return card.type_line.toLowerCase().includes('basic land') ? 99 : 4;
  };

  const handleSaveDeck = () => {
    if (!deckName.trim()) {
      toast({
        title: "Deck Name Required",
        description: "Please enter a name for your deck.",
        variant: "destructive"
      });
      return;
    }

    const deckData: DeckData = {
      name: deckName,
      format: deckFormat,
      description: deckDescription,
      commanderId: commander?.id,
      cards: Array.from(deckCards.values()).map(({ card, quantity }) => ({
        cardId: card.id,
        quantity
      }))
    };

    saveDeckMutation.mutate(deckData);
  };

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setIsModalOpen(true);
  };

  const deckArray = Array.from(deckCards.values());
  const totalCards = deckArray.reduce((sum, { quantity }) => sum + quantity, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Deck Building Panel */}
          <div className="lg:w-1/3 space-y-6">
            <div className="bg-slate-900 rounded-lg p-6">
              <h1 className="text-2xl font-bold mb-4 flex items-center">
                <FileText className="w-6 h-6 mr-2" />
                Deck Builder
              </h1>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deckName">Deck Name</Label>
                  <Input
                    id="deckName"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    placeholder="Enter deck name..."
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                
                <div>
                  <Label htmlFor="deckFormat">Format</Label>
                  <Select value={deckFormat} onValueChange={setDeckFormat}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commander">Commander</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="legacy">Legacy</SelectItem>
                      <SelectItem value="vintage">Vintage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="deckDescription">Description</Label>
                  <Textarea
                    id="deckDescription"
                    value={deckDescription}
                    onChange={(e) => setDeckDescription(e.target.value)}
                    placeholder="Describe your deck strategy..."
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                
                <Button onClick={handleSaveDeck} className="w-full" disabled={saveDeckMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {saveDeckMutation.isPending ? 'Saving...' : 'Save Deck'}
                </Button>
              </div>
            </div>

            {/* Saved Decks */}
            <div className="bg-slate-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Saved Decks</h2>
              <div className="space-y-2">
                {savedDecks?.map((deck: any) => (
                  <Button
                    key={deck.id}
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => loadDeckMutation.mutate(deck.id)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {deck.name} ({deck.format})
                  </Button>
                ))}
              </div>
            </div>

            {/* Card Search */}
            <div className="bg-slate-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Add Cards
              </h2>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for cards..."
                className="bg-slate-800 border-slate-700 mb-4"
              />
              
              {isSearching && (
                <div className="text-center py-4 text-slate-400">Searching...</div>
              )}
              
              <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {searchResults?.cards?.map((card: Card) => (
                  <div key={card.id} className="relative">
                    <CardTile card={card} onClick={handleCardClick} />
                    <Button
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() => addCardToDeck(card)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Deck List */}
          <div className="lg:w-2/3">
            <div className="bg-slate-900 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">
                  Current Deck ({totalCards} cards)
                </h2>
                {deckFormat === 'commander' && commander && (
                  <div className="flex items-center">
                    <Crown className="w-5 h-5 mr-2 text-yellow-400" />
                    <span className="text-sm text-slate-400">Commander: {commander.name}</span>
                  </div>
                )}
              </div>

              {deckArray.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Your deck is empty. Start by searching and adding cards.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {deckArray.map(({ card, quantity }) => (
                    <DeckCardTile
                      key={card.id}
                      card={card}
                      quantity={quantity}
                      maxCopies={getMaxCopies(card)}
                      onAdd={() => addCardToDeck(card)}
                      onRemove={() => removeCardFromDeck(card.id)}
                      onClick={handleCardClick}
                      onSetCommander={deckFormat === 'commander' ? setCommander : undefined}
                      isCommander={commander?.id === card.id}
                      showControls={true}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCardClick={handleCardClick}
        onAddCard={addCardToDeck}
      />
    </div>
  );
}