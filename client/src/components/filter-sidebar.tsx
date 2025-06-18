import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchFilters } from "@shared/schema";
import { Brain } from "lucide-react";

interface FilterSidebarProps {
  isOpen: boolean;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClose: () => void;
}

const MTG_COLORS = [
  { code: 'W', name: 'White', gradient: 'linear-gradient(135deg, #fffbd5 0%, #f8f4d6 100%)', textColor: 'text-slate-800' },
  { code: 'U', name: 'Blue', gradient: 'linear-gradient(135deg, #0e68ab 0%, #1a7bc4 100%)', textColor: 'text-white' },
  { code: 'B', name: 'Black', gradient: 'linear-gradient(135deg, #150b00 0%, #2a1100 100%)', textColor: 'text-white' },
  { code: 'R', name: 'Red', gradient: 'linear-gradient(135deg, #d3202a 0%, #e63946 100%)', textColor: 'text-white' },
  { code: 'G', name: 'Green', gradient: 'linear-gradient(135deg, #00733e 0%, #198754 100%)', textColor: 'text-white' },
];

const CARD_TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];
const RARITIES = ['common', 'uncommon', 'rare', 'mythic'];
const FORMATS = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer'];

export function FilterSidebar({ isOpen, filters, onFiltersChange, onClose }: FilterSidebarProps) {
  const updateFilters = (updates: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const toggleColor = (colorCode: string) => {
    const currentColors = filters.colors || [];
    const newColors = currentColors.includes(colorCode)
      ? currentColors.filter(c => c !== colorCode)
      : [...currentColors, colorCode];
    
    updateFilters({ colors: newColors.length > 0 ? newColors : undefined });
  };

  const toggleType = (type: string) => {
    const currentTypes = filters.types || [];
    const lowerType = type.toLowerCase();
    const newTypes = currentTypes.includes(lowerType)
      ? currentTypes.filter(t => t !== lowerType)
      : [...currentTypes, lowerType];
    
    updateFilters({ types: newTypes.length > 0 ? newTypes : undefined });
  };

  const toggleRarity = (rarity: string) => {
    const currentRarities = filters.rarities || [];
    const newRarities = currentRarities.includes(rarity)
      ? currentRarities.filter(r => r !== rarity)
      : [...currentRarities, rarity];
    
    updateFilters({ rarities: newRarities.length > 0 ? newRarities : undefined });
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        w-80 bg-slate-800 border-r border-slate-700 overflow-y-auto
        transform transition-transform duration-300 ease-in-out
        fixed lg:relative z-40 h-full
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-slate-400 hover:text-white text-sm"
            >
              Clear All
            </Button>
          </div>

          {/* Color Filter */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Colors</h3>
            <div className="grid grid-cols-5 gap-2">
              {MTG_COLORS.map((color) => (
                <button
                  key={color.code}
                  onClick={() => toggleColor(color.code)}
                  className={`
                    w-10 h-10 rounded-full border-2 flex items-center justify-center 
                    transition-all duration-200 hover:scale-110
                    ${(filters.colors || []).includes(color.code)
                      ? 'border-white ring-2 ring-white ring-opacity-50'
                      : 'border-slate-600 hover:border-slate-400'
                    }
                  `}
                  style={{ background: color.gradient }}
                  title={color.name}
                >
                  <span className={`font-bold text-sm ${color.textColor}`}>
                    {color.code}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <Label className="flex items-center space-x-2 text-xs text-slate-400">
                <Checkbox
                  checked={filters.includeMulticolored || false}
                  onCheckedChange={(checked) => 
                    updateFilters({ includeMulticolored: checked as boolean })
                  }
                />
                <span>Include multicolored</span>
              </Label>
            </div>
          </div>

          {/* Card Types */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Card Types</h3>
            <div className="space-y-2">
              {CARD_TYPES.map((type) => (
                <Label key={type} className="flex items-center space-x-2">
                  <Checkbox
                    checked={(filters.types || []).includes(type.toLowerCase())}
                    onCheckedChange={() => toggleType(type)}
                  />
                  <span className="text-sm">{type}</span>
                </Label>
              ))}
            </div>
          </div>

          {/* Mana Value */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Mana Value</h3>
            <div className="space-y-3">
              <div>
                <Label className="block text-xs text-slate-400 mb-1">Min</Label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={filters.minMv || ''}
                  onChange={(e) => 
                    updateFilters({ 
                      minMv: e.target.value ? parseInt(e.target.value) : undefined 
                    })
                  }
                  className="bg-slate-700 border-slate-600 text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="block text-xs text-slate-400 mb-1">Max</Label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={filters.maxMv || ''}
                  onChange={(e) => 
                    updateFilters({ 
                      maxMv: e.target.value ? parseInt(e.target.value) : undefined 
                    })
                  }
                  className="bg-slate-700 border-slate-600 text-sm"
                  placeholder="20"
                />
              </div>
            </div>
          </div>

          {/* Rarity */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Rarity</h3>
            <div className="space-y-2">
              {RARITIES.map((rarity) => (
                <Label key={rarity} className="flex items-center space-x-2">
                  <Checkbox
                    checked={(filters.rarities || []).includes(rarity)}
                    onCheckedChange={() => toggleRarity(rarity)}
                  />
                  <span className="text-sm capitalize">{rarity}</span>
                </Label>
              ))}
            </div>
          </div>

          {/* Format Legality */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Format</h3>
            <Select
              value={filters.format || 'all'}
              onValueChange={(value) => 
                updateFilters({ format: value === 'all' ? undefined : value })
              }
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-sm">
                <SelectValue placeholder="All Formats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formats</SelectItem>
                {FORMATS.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format.charAt(0).toUpperCase() + format.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI Recommendations */}
          <div className="mb-6 p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
            <h3 className="text-sm font-medium text-purple-200 mb-2 flex items-center">
              <Brain className="h-4 w-4 mr-2" />
              AI Recommendations
            </h3>
            <p className="text-xs text-purple-300 mb-3">
              Find cards similar to your favorites using neural network analysis
            </p>
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-3">
              Enable Smart Suggestions
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
