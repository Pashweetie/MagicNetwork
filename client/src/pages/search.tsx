import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@shared/schema";
import { Header } from "@/components/header";
import { FilterSidebar } from "@/components/filter-sidebar";
import { CardGrid } from "@/components/card-grid";
import { CardDetailModal } from "@/components/card-detail-modal";
import { DeckCardTile } from "@/components/deck-card-tile";
import { ArchetypeAnalyzer } from "@/components/archetype-analyzer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid, List, Package, Settings, X, Crown, ChevronUp, ChevronDown } from "lucide-react";
import { useCardSearch } from "@/hooks/use-scryfall";
import { useDeck, FORMATS } from "@/hooks/use-deck";
import { ScryfallQueryParser, ScryfallParser } from "@/lib/scryfall-parser";
import { SearchFilters } from "@shared/schema";
import { Link } from "wouter";

export default function Search() {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showDeckPanel, setShowDeckPanel] = useState(false);
  const [sortBy, setSortBy] = useState("relevance");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [manualFilters, setManualFilters] = useState<SearchFilters>({});
  const [useManualFilters, setUseManualFilters] = useState(false);
  
  const deck = useDeck();

  // Use either parsed query filters OR manual filters, with commander restrictions
  const activeFilters = useMemo(() => {
    let baseFilters;
    if (useManualFilters && Object.keys(manualFilters).length > 0) {
      baseFilters = manualFilters;
    } else {
      baseFilters = ScryfallQueryParser.parseQuery(searchQuery);
    }

    // Apply commander color identity filtering
    if (deck.format.name === 'Commander' && deck.commander) {
      const commanderColors = deck.commander.color_identity || [];
      let colorFilter = '';
      
      if (commanderColors.length > 0) {
        colorFilter = `id<=${commanderColors.join('')}`;
      } else {
        colorFilter = 'id:c'; // colorless only if commander is colorless
      }
      
      return {
        ...baseFilters,
        query: baseFilters.query ? `${baseFilters.query} ${colorFilter}` : colorFilter
      };
    }
    
    return baseFilters;
  }, [searchQuery, manualFilters, useManualFilters, deck.format.name, deck.commander]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isLoading,
    error,
    refetch,
  } = useCardSearch(activeFilters);

  // Flatten all pages of cards
  const allCards = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || [];
  }, [data]);

  const totalCards = data?.pages[0]?.total_cards || 0;

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Parse query and update filters
    if (query.trim()) {
      const parsedFilters = ScryfallParser.parseQuery(query);
      setManualFilters(parsedFilters);
      setUseManualFilters(Object.keys(parsedFilters).length > 0);
    } else {
      setUseManualFilters(false);
      setManualFilters({});
    }
  }, []);

  const handleFiltersChange = useCallback((filters: SearchFilters) => {
    setManualFilters(filters);
    setUseManualFilters(Object.keys(filters).length > 0);
    
    // Update search query to show filters
    const queryText = ScryfallParser.filtersToQuery(filters);
    setSearchQuery(queryText);
  }, []);

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCard(null);
  };

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetching, fetchNextPage]);

  const handleRetry = () => {
    refetch();
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const getDisplayQuery = () => {
    const parts: string[] = [];
    
    // Always show search query if present
    if (searchQuery) {
      parts.push(searchQuery);
    }
    
    // Show the actual query being sent (including commander filter)
    if (activeFilters.query && activeFilters.query !== searchQuery) {
      parts.push(`Filter: ${activeFilters.query}`);
    }
    
    if (useManualFilters) {
      if (activeFilters.colors?.length) {
        parts.push(`Colors: ${activeFilters.colors.join(', ')}`);
      }
      
      if (activeFilters.types?.length) {
        parts.push(`Types: ${activeFilters.types.join(', ')}`);
      }
      
      if (activeFilters.rarities?.length) {
        parts.push(`Rarity: ${activeFilters.rarities.join(', ')}`);
      }
      
      if (activeFilters.oracleText) {
        parts.push(`Text: "${activeFilters.oracleText}"`);
      }
    }
    
    return parts.join(' • ') || 'All cards';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <Header
        onSearch={handleSearch}
        onToggleSidebar={toggleSidebar}
        searchQuery={searchQuery}
      />
      
      <div className="flex h-screen pt-16">
        {isSidebarOpen && (
          <FilterSidebar
            isOpen={isSidebarOpen}
            filters={manualFilters}
            onFiltersChange={handleFiltersChange}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}
        
        <main className="flex-1 overflow-y-auto">
          {/* Deck Panel Toggle */}
          <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDeckPanel(!showDeckPanel)}
                  className="flex items-center space-x-2"
                >
                  <Package className="w-4 h-4" />
                  <span>Deck ({deck.totalCards})</span>
                </Button>
                
                {/* Commander Display */}
                {deck.commander && (
                  <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-200">Commander: {deck.commander.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 text-yellow-400 hover:text-yellow-300"
                      onClick={() => deck.setCommander(null)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-400">Format:</span>
                <Select 
                  value={deck.format.name} 
                  onValueChange={(value) => {
                    const format = FORMATS.find(f => f.name === value);
                    if (format) deck.setFormat(format);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(format => (
                      <SelectItem key={format.name} value={format.name}>
                        {format.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {isLoading ? 'Searching...' : `${totalCards.toLocaleString()} cards found`}
                </h2>
                <p className="text-sm text-slate-400">
                  Showing results for: <span className="font-mono text-blue-400">{getDisplayQuery()}</span>
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Sort: Relevance</SelectItem>
                    <SelectItem value="name">Name A-Z</SelectItem>
                    <SelectItem value="name_desc">Name Z-A</SelectItem>
                    <SelectItem value="cmc">Mana Value</SelectItem>
                    <SelectItem value="released">Release Date</SelectItem>
                    <SelectItem value="usd">Price</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex bg-slate-700 rounded overflow-hidden">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={viewMode === "list" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Deck Panel */}
          {showDeckPanel && (
            <div className="px-6 py-4 bg-slate-850 space-y-6">
              <UICard className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Package className="w-5 h-5" />
                      <span>Current Deck</span>
                      <Badge variant="secondary">{deck.totalCards} cards</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowDeckPanel(false)}
                    >
                      ✕
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {deck.deckEntries.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                      <p>No cards in deck</p>
                      <p className="text-sm mt-1">Click + on cards to add them</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 max-h-64 overflow-y-auto">
                      {deck.deckEntries.map(entry => (
                        <DeckCardTile
                          key={entry.card.id}
                          card={entry.card}
                          quantity={entry.quantity}
                          maxCopies={deck.getMaxCopies(entry.card)}
                          onAdd={() => deck.addCard(entry.card)}
                          onRemove={() => deck.removeCard(entry.card.id)}
                          onClick={handleCardClick}
                          onSetCommander={deck.format.name === 'Commander' ? deck.setCommanderFromCard : undefined}
                          isCommander={deck.commander?.id === entry.card.id}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </UICard>
              
              {/* AI Archetype Analysis */}
              {deck.allCards.length > 0 && (
                <ArchetypeAnalyzer 
                  cards={deck.allCards} 
                  onSuggestCard={(card: Card) => deck.addCard(card)}
                />
              )}
            </div>
          )}

          {/* Card Grid with Deck Functionality */}
          <div className="p-6">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {allCards.map((card, index) => (
                  <DeckCardTile
                    key={`${card.id}-${index}`}
                    card={card}
                    quantity={deck.getCardQuantity(card.id)}
                    maxCopies={deck.getMaxCopies(card)}
                    onAdd={() => deck.addCard(card)}
                    onRemove={() => deck.removeCard(card.id)}
                    onClick={handleCardClick}
                    onSetCommander={deck.format.name === 'Commander' ? deck.setCommanderFromCard : undefined}
                    isCommander={deck.commander?.id === card.id}
                  />
                ))}
              </div>
            ) : (
              <CardGrid
                cards={allCards}
                isLoading={isFetching}
                hasMore={hasNextPage || false}
                onLoadMore={handleLoadMore}
                onRetry={handleRetry}
                error={error?.message}
              />
            )}

            {/* Loading and pagination */}
            {isFetching && (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}

            {hasNextPage && !isFetching && (
              <div className="flex justify-center py-8">
                <Button 
                  onClick={handleLoadMore}
                  variant="outline"
                  disabled={isFetching}
                >
                  Load More
                </Button>
              </div>
            )}
            
            {isFetching && (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
        </main>
      </div>

      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
