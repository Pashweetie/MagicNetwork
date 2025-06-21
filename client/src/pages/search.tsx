import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@shared/schema";
import { Header } from "@/components/header";
import { FilterSidebar } from "@/components/filter-sidebar";
import { CardGrid } from "@/components/card-grid";
import { CardDetailModal } from "@/components/card-detail-modal";
import { DeckImportDialog } from "@/components/DeckImportDialog";
import { DeckFullscreenModal } from "@/components/deck-fullscreen-modal";
import { SharedCardTile } from "@/components/shared-card-tile";
import { StackedDeckDisplay } from "@/components/stacked-deck-display";
import { EdhrecRecommendations } from "@/components/edhrec-recommendations";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid, List, Package, Settings, X, Crown, ChevronUp, ChevronDown, Upload, Trash2 } from "lucide-react";
import { useCardSearch } from "@/hooks/use-scryfall";
import { useDeck, FORMATS } from "@/hooks/use-deck";
import { useCardImagePreloader } from "@/hooks/use-image-preloader";
import { useQuery } from "@tanstack/react-query";
import { ScryfallQueryParser, ScryfallParser } from "@/lib/scryfall-parser";
import { SearchFilters } from "@shared/schema";
import { Link } from "wouter";

export default function Search() {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showDeckPanel, setShowDeckPanel] = useState(false);
  const [deckViewMode, setDeckViewMode] = useState<"grid" | "stacked">("stacked");
  const [sortBy, setSortBy] = useState("relevance");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [manualFilters, setManualFilters] = useState<SearchFilters>({});
  const [useManualFilters, setUseManualFilters] = useState(false);
  const [isDeckFullscreenOpen, setIsDeckFullscreenOpen] = useState(false);
  const [showEdhrecResults, setShowEdhrecResults] = useState(false);
  const [linkedEdhrecCards, setLinkedEdhrecCards] = useState<Card[]>([]);

  
  const deck = useDeck();
  const { preloadSearchResults } = useCardImagePreloader();

  // Use either parsed query filters OR manual filters, with commander and format restrictions
  const activeFilters = useMemo(() => {
    let baseFilters;
    if (useManualFilters && Object.keys(manualFilters).length > 0) {
      baseFilters = manualFilters;
    } else {
      baseFilters = ScryfallQueryParser.parseQuery(searchQuery);
    }

    // Apply format filtering
    const formatFilters: string[] = [];
    
    // Add format-specific filters (only for non-casual formats)
    if (deck.format.name !== 'Casual') {
      formatFilters.push(`legal:${deck.format.name.toLowerCase()}`);
    }

    // Apply commander color identity filtering only if commander is selected
    if (deck.format.name === 'Commander' && deck.commander) {
      const commanderColors = deck.commander.color_identity || [];
      
      if (commanderColors.length > 0) {
        formatFilters.push(`id<=${commanderColors.join('')}`);
      } else {
        formatFilters.push('id:c'); // colorless only if commander is colorless
      }
    }
    
    // Combine all filters
    if (formatFilters.length > 0) {
      const combinedFilter = formatFilters.join(' ');
      return {
        ...baseFilters,
        query: baseFilters.query ? `${baseFilters.query} ${combinedFilter}` : combinedFilter
      };
    }
    
    return baseFilters;
  }, [searchQuery, manualFilters, useManualFilters, deck.format.name, deck.commander]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useCardSearch(showEdhrecResults ? {} : activeFilters);

  // Fetch EDHREC recommendations when enabled
  const { data: edhrecData, isLoading: isEdhrecLoading, error: edhrecError } = useQuery({
    queryKey: ['edhrec-recommendations', deck.commander?.id, showEdhrecResults],
    queryFn: async () => {
      if (!deck.commander || !showEdhrecResults) return null;
      
      const response = await fetch(`/api/edhrec/commander/${deck.commander.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch EDHREC recommendations');
      }
      return response.json();
    },
    enabled: showEdhrecResults && !!deck.commander
  });

  // Link EDHREC cards with Scryfall data
  useEffect(() => {
    if (!showEdhrecResults || !edhrecData || !deck.commander) {
      setLinkedEdhrecCards([]);
      return;
    }

    const linkCards = async () => {
      const allEdhrecCards = [
        ...edhrecData.cards.creatures,
        ...edhrecData.cards.instants,
        ...edhrecData.cards.sorceries,
        ...edhrecData.cards.artifacts,
        ...edhrecData.cards.enchantments,
        ...edhrecData.cards.planeswalkers,
        ...edhrecData.cards.lands
      ];

      const linkedCards = [];
      
      // Process cards in smaller batches to avoid overwhelming the API
      const maxCards = Math.min(allEdhrecCards.length, 200);
      for (let i = 0; i < maxCards; i += 5) {
        const batch = allEdhrecCards.slice(i, i + 5);
        const batchResults = await Promise.all(
          batch.map(async (edhrecCard: any) => {
            try {
              // Search for exact card match using the card name
              const searchResponse = await fetch(`/api/cards/search?q=${encodeURIComponent(edhrecCard.name)}&page=1`);
              if (searchResponse.ok) {
                const searchResult = await searchResponse.json();
                const exactMatch = searchResult.data.find((card: any) => 
                  card.name.toLowerCase() === edhrecCard.name.toLowerCase()
                );
                
                if (exactMatch) {
                  return {
                    ...exactMatch,
                    edhrec_rank: edhrecCard.num_decks,
                    edhrec_synergy: edhrecCard.synergy,
                    edhrec_url: edhrecCard.url
                  };
                } else {
                  // Try fuzzy matching as fallback
                  const fuzzyMatch = searchResult.data.find((card: any) => 
                    card.name.toLowerCase().includes(edhrecCard.name.toLowerCase()) ||
                    edhrecCard.name.toLowerCase().includes(card.name.toLowerCase())
                  );
                  if (fuzzyMatch) {
                    return {
                      ...fuzzyMatch,
                      edhrec_rank: edhrecCard.num_decks,
                      edhrec_synergy: edhrecCard.synergy,
                      edhrec_url: edhrecCard.url
                    };
                  }
                }
              }
              return null;
            } catch (error) {
              return null;
            }
          })
        );
        
        linkedCards.push(...batchResults.filter(Boolean));
        
        // Small delay between batches
        if (i + 5 < maxCards) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      setLinkedEdhrecCards(linkedCards);
    };

    linkCards();
  }, [showEdhrecResults, edhrecData, deck.commander]);

  // Only show cards when there's an active search or showing EDHREC results
  const shouldShowResults = searchQuery.trim() || useManualFilters || showEdhrecResults;



  // Flatten all pages of cards
  const allCards = useMemo(() => {
    if (!shouldShowResults) return [];
    
    if (showEdhrecResults && deck.commander && edhrecData) {
      // Use stored linked cards if available, otherwise return empty array to trigger linking
      if (linkedEdhrecCards.length > 0) {
        let filteredCards = [...linkedEdhrecCards];
        
        // Apply filters to EDHREC results
      if (activeFilters.types?.length) {
        filteredCards = filteredCards.filter(card => 
          activeFilters.types!.some(type => 
            card.type_line.toLowerCase().includes(type.toLowerCase())
          )
        );
      }

      if (activeFilters.colors?.length) {
        filteredCards = filteredCards.filter(card => 
          activeFilters.colors!.some(color => 
            card.color_identity.includes(color)
          )
        );
      }

      if (activeFilters.rarities?.length) {
        filteredCards = filteredCards.filter(card => 
          activeFilters.rarities!.includes(card.rarity)
        );
      }

      if (activeFilters.minMv !== undefined) {
        filteredCards = filteredCards.filter(card => card.cmc >= activeFilters.minMv!);
      }

      if (activeFilters.maxMv !== undefined) {
        filteredCards = filteredCards.filter(card => card.cmc <= activeFilters.maxMv!);
      }

      if (activeFilters.oracleText) {
        const searchText = activeFilters.oracleText.toLowerCase();
        filteredCards = filteredCards.filter(card => 
          card.oracle_text.toLowerCase().includes(searchText) ||
          card.name.toLowerCase().includes(searchText)
        );
      }

        return filteredCards;
      }
      
      // Return empty array while cards are being linked
      return [];
    }
    
    const searchData = data?.pages.flatMap(page => page.data) || [];
    
    // Preload images for search results
    if (searchData.length > 0) {
      preloadSearchResults(searchData);
    }
    
    return searchData;
  }, [data, shouldShowResults, preloadSearchResults, showEdhrecResults, deck.commander, edhrecData, linkedEdhrecCards, activeFilters]);



  const totalCards = showEdhrecResults ? linkedEdhrecCards.length : 
    (shouldShowResults ? (data?.pages[0]?.total_cards || 0) : 0);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setUseManualFilters(false); // Switch back to query-based filters when searching
    
    // Parse query and update filters
    if (query.trim()) {
      const parsedFilters = ScryfallQueryParser.parseQuery(query);
      setManualFilters(parsedFilters);
      setUseManualFilters(Object.keys(parsedFilters).length > 0);
    } else {
      // Clear all filters when search is empty
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
    console.log('handleLoadMore called:', { hasNextPage, isFetching, shouldShowResults });
    if (hasNextPage && !isFetching && shouldShowResults) {
      console.log('Fetching next page...');
      fetchNextPage();
    }
  }, [hasNextPage, isFetching, fetchNextPage, shouldShowResults]);

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
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeckPanel(!showDeckPanel)}
                    className="flex items-center space-x-2"
                  >
                    <Package className="w-4 h-4" />
                    <span>Deck ({deck.totalCards})</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDeckFullscreenOpen(true)}
                    className="flex items-center space-x-1"
                    title="Open deck in fullscreen"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                </div>
                
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
                    <Button
                      size="sm"
                      variant={showEdhrecResults ? "default" : "outline"}
                      className={showEdhrecResults ? "bg-purple-600 hover:bg-purple-700" : "border-purple-500/50 text-purple-400 hover:bg-purple-900/20"}
                      onClick={() => setShowEdhrecResults(!showEdhrecResults)}
                      disabled={!deck.commander}
                    >
                      EDHREC
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
                  {(isFetching || (showEdhrecResults && isEdhrecLoading)) ? 
                    (showEdhrecResults ? 'Loading EDHREC recommendations...' : 'Searching...') : 
                    showEdhrecResults ? 
                      `Found ${totalCards} EDHREC recommendations` :
                      `Found ${totalCards} cards`
                  }
                </h2>
                {!showEdhrecResults && (
                  <p className="text-sm text-slate-400">
                    Showing results for: <span className="font-mono text-blue-400">{getDisplayQuery()}</span>
                  </p>
                )}
                {showEdhrecResults && deck.commander && (
                  <p className="text-sm text-purple-400">
                    EDHREC recommendations for <span className="font-medium">{deck.commander.name}</span>
                  </p>
                )}
                {showEdhrecResults && !deck.commander && (
                  <p className="text-yellow-400 text-sm">
                    Select a commander to see EDHREC recommendations
                  </p>
                )}
                {showEdhrecResults && edhrecError && (
                  <p className="text-red-400 text-sm">
                    Unable to load EDHREC data for this commander
                  </p>
                )}
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
                    <div className="flex items-center space-x-2">
                      <div className="flex bg-slate-700 rounded overflow-hidden">
                        <Button
                          variant={deckViewMode === "grid" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setDeckViewMode("grid")}
                          className={deckViewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}
                        >
                          <Grid className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={deckViewMode === "stacked" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setDeckViewMode("stacked")}
                          className={deckViewMode === "stacked" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>
                      <DeckImportDialog>
                        <Button size="sm" variant="outline">
                          <Upload className="w-4 h-4 mr-1" />
                          Import
                        </Button>
                      </DeckImportDialog>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          if (confirm('Are you sure you want to clear your entire deck?')) {
                            deck.clearDeck();
                          }
                        }}
                        className="text-red-400 border-red-500/50 hover:bg-red-900/20 hover:border-red-400"
                        disabled={deck.totalCards === 0}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowDeckPanel(false)}
                      >
                        ✕
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {deck.deckEntries.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                      <p>No cards in deck</p>
                      <p className="text-sm mt-1">Click + on cards to add them</p>
                    </div>
                  ) : deckViewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 max-h-64 overflow-y-auto">
                      {deck.deckEntries.map(entry => (
                        <SharedCardTile
                          key={entry.card.id}
                          variant="deck"
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
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <StackedDeckDisplay
                        deckEntries={deck.deckEntries}
                        onAdd={deck.addCard}
                        onRemove={deck.removeCard}
                        onClick={handleCardClick}
                        onSetCommander={deck.format.name === 'Commander' ? deck.setCommanderFromCard : undefined}
                        commander={deck.commander}
                        getMaxCopies={deck.getMaxCopies}
                      />
                    </div>
                  )}
                </CardContent>
              </UICard>
              


            </div>
          )}

          {/* Card Grid with Deck Functionality */}
          <div className="p-6">
            {showEdhrecResults && deck.commander && allCards.length > 0 && (
              <div className="mb-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                <div className="flex items-center space-x-2 text-purple-300">
                  <span className="text-sm font-medium">EDHREC recommendations for {deck.commander.name}</span>
                </div>
                <p className="text-xs text-purple-400 mt-1">
                  Showing authentic EDHREC data with synergy scores and deck inclusion rates
                </p>
              </div>
            )}
            
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {allCards.filter(card => card && card.type_line && card.name).map((card, index) => (
                  <SharedCardTile
                    key={`${card.id}-${index}`}
                    variant="deck"
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
                isLoading={isFetchingNextPage}
                hasMore={hasNextPage || false}
                onLoadMore={handleLoadMore}
                onRetry={handleRetry}
                error={error?.message}
              />
            )}

            {/* Initial loading indicator */}
            {isLoading && !allCards.length && (
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
        onCardClick={handleCardClick}
        onAddCard={deck.addCard}
        currentFilters={activeFilters}
      />

      <DeckFullscreenModal
        isOpen={isDeckFullscreenOpen}
        onClose={() => setIsDeckFullscreenOpen(false)}
        onCardClick={handleCardClick}
      />
    </div>
  );
}
