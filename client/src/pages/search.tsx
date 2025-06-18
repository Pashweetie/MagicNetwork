import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/header";
import { FilterSidebar } from "@/components/filter-sidebar";
import { CardGrid } from "@/components/card-grid";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid, List } from "lucide-react";
import { useCardSearch } from "@/hooks/use-scryfall";
import { ScryfallQueryParser } from "@/lib/scryfall-parser";
import { SearchFilters } from "@shared/schema";

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sortBy, setSortBy] = useState("relevance");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [manualFilters, setManualFilters] = useState<SearchFilters>({});
  const [useManualFilters, setUseManualFilters] = useState(false);

  // Use either parsed query filters OR manual filters, not both
  const activeFilters = useMemo(() => {
    if (useManualFilters && Object.keys(manualFilters).length > 0) {
      return manualFilters;
    } else {
      return ScryfallQueryParser.parseQuery(searchQuery);
    }
  }, [searchQuery, manualFilters, useManualFilters]);

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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setUseManualFilters(false); // Switch to search query mode
    setManualFilters({}); // Clear manual filters
  };

  const handleFiltersChange = (filters: SearchFilters) => {
    setManualFilters(filters);
    setUseManualFilters(Object.keys(filters).length > 0); // Switch to manual filter mode if filters exist
    if (Object.keys(filters).length > 0) {
      setSearchQuery(""); // Clear search query when using manual filters
    }
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  };

  const handleRetry = () => {
    refetch();
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const getDisplayQuery = () => {
    if (useManualFilters) {
      const parts: string[] = [];
      
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
      
      return parts.join(' • ') || 'Filter criteria';
    } else {
      return searchQuery || 'All cards';
    }
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
          {/* Results Header */}
          <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
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

          {/* Card Grid */}
          <div className="p-6">
            <CardGrid
              cards={allCards}
              isLoading={isFetching}
              hasMore={hasNextPage || false}
              onLoadMore={handleLoadMore}
              onRetry={handleRetry}
              error={error?.message}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
