import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Settings, HelpCircle, Menu, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onSearch: (query: string) => void;
  onToggleSidebar: () => void;
  searchQuery: string;
}

export function Header({ onSearch, onToggleSidebar, searchQuery }: HeaderProps) {
  const [query, setQuery] = useState(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    // Delay hiding to allow clicking on suggestions
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
              title="Toggle filters"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">MTG Intelligence</h1>
              <Badge variant="secondary" className="bg-purple-600 text-white">
                BETA
              </Badge>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-4 relative">
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='Search cards... (e.g., "t:creature c:red mv:3")'
                />
              </div>
            </form>
            
            {/* Search Suggestions */}
            {showSuggestions && (
              <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50">
                <div className="p-3 text-xs text-slate-400">
                  <div className="mb-2">
                    <strong className="text-slate-200">Search Syntax:</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-blue-400">t:</span> Type (creature, instant, etc.)</div>
                    <div><span className="text-green-400">c:</span> Color (w, u, b, r, g)</div>
                    <div><span className="text-purple-400">mv:</span> Mana value</div>
                    <div><span className="text-yellow-400">f:</span> Format (standard, modern, etc.)</div>
                    <div><span className="text-pink-400">r:</span> Rarity (c, u, r, m)</div>
                    <div><span className="text-orange-400">s:</span> Set code</div>
                    <div><span className="text-cyan-400">o:</span> Oracle text</div>
                    <div><span className="text-red-400">pow:</span> Power, <span className="text-red-400">tou:</span> Toughness</div>
                    <div><span className="text-indigo-400">k:</span> Keywords</div>
                    <div><span className="text-emerald-400">usd:</span> Price range</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-700"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-700"
              title="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
