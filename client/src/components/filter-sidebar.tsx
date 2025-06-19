import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { SearchFilters } from "@shared/schema";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";

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

const CARD_TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle', 'Tribal'];
const RARITIES = ['common', 'uncommon', 'rare', 'mythic'];
const FORMATS = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'pauper', 'historic', 'alchemy'];
const POPULAR_KEYWORDS = ['Flying', 'Trample', 'Lifelink', 'Deathtouch', 'First Strike', 'Double Strike', 'Vigilance', 'Haste', 'Reach', 'Hexproof', 'Ward', 'Flash', 'Menace'];

export function FilterSidebar({ isOpen, filters, onFiltersChange, onClose }: FilterSidebarProps) {
  const [expandedSections, setExpandedSections] = useState({
    advanced: false,
    powerToughness: false,
    price: false,
    keywords: false,
  });
  
  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof SearchFilters];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

  const toggleKeyword = (keyword: string) => {
    const currentKeywords = filters.keywords || [];
    const lowerKeyword = keyword.toLowerCase();
    const newKeywords = currentKeywords.includes(lowerKeyword)
      ? currentKeywords.filter(k => k !== lowerKeyword)
      : [...currentKeywords, lowerKeyword];
    
    updateFilters({ keywords: newKeywords.length > 0 ? newKeywords : undefined });
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
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-white">Filters</h2>
              {hasActiveFilters && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-slate-400 hover:text-white text-sm"
                disabled={!hasActiveFilters}
              >
                Clear All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-slate-400 hover:text-white text-sm lg:hidden"
              >
                ×
              </Button>
            </div>
          </div>
          
          {hasActiveFilters && (
            <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
              <p className="text-xs text-blue-300">
                Using filter criteria instead of search query. Clear filters to return to text search.
              </p>
            </div>
          )}

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

          {/* Oracle Text Search */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Oracle Text</h3>
            <Textarea
              value={filters.oracleText || ''}
              onChange={(e) => updateFilters({ oracleText: e.target.value || undefined })}
              className="bg-slate-700 border-slate-600 text-sm resize-none"
              rows={2}
              placeholder="Search card text..."
            />
          </div>

          {/* Set Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Set</h3>
            <Input
              value={filters.set || ''}
              onChange={(e) => updateFilters({ set: e.target.value || undefined })}
              className="bg-slate-700 border-slate-600 text-sm"
              placeholder="e.g., BRO, DMU, ONE"
            />
          </div>

          <Separator className="my-6 bg-slate-600" />

          {/* Advanced Filters */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => toggleSection('advanced')}
              className="w-full justify-between text-slate-300 hover:text-white p-0"
            >
              <h3 className="text-sm font-medium">Advanced Filters</h3>
              {expandedSections.advanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {expandedSections.advanced && (
              <div className="mt-3 space-y-4">
                <div>
                  <Label className="block text-xs text-slate-400 mb-1">Artist</Label>
                  <Input
                    value={filters.artist || ''}
                    onChange={(e) => updateFilters({ artist: e.target.value || undefined })}
                    className="bg-slate-700 border-slate-600 text-sm"
                    placeholder="Artist name"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Power/Toughness */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => toggleSection('powerToughness')}
              className="w-full justify-between text-slate-300 hover:text-white p-0"
            >
              <h3 className="text-sm font-medium">Power/Toughness</h3>
              {expandedSections.powerToughness ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {expandedSections.powerToughness && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="block text-xs text-slate-400 mb-1">Power</Label>
                    <Input
                      type="number"
                      value={filters.power || ''}
                      onChange={(e) => updateFilters({ power: e.target.value || undefined })}
                      className="bg-slate-700 border-slate-600 text-sm"
                      placeholder="3"
                    />
                  </div>
                  <div>
                    <Label className="block text-xs text-slate-400 mb-1">Toughness</Label>
                    <Input
                      type="number"
                      value={filters.toughness || ''}
                      onChange={(e) => updateFilters({ toughness: e.target.value || undefined })}
                      className="bg-slate-700 border-slate-600 text-sm"
                      placeholder="2"
                    />
                  </div>
                </div>
                <div>
                  <Label className="block text-xs text-slate-400 mb-1">Loyalty</Label>
                  <Input
                    value={filters.loyalty || ''}
                    onChange={(e) => updateFilters({ loyalty: e.target.value || undefined })}
                    className="bg-slate-700 border-slate-600 text-sm"
                    placeholder=">=4"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Price Range */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => toggleSection('price')}
              className="w-full justify-between text-slate-300 hover:text-white p-0"
            >
              <h3 className="text-sm font-medium">Price Range (USD)</h3>
              {expandedSections.price ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {expandedSections.price && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="block text-xs text-slate-400 mb-1">Min $</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={filters.minPrice || ''}
                      onChange={(e) => 
                        updateFilters({ 
                          minPrice: e.target.value ? parseFloat(e.target.value) : undefined 
                        })
                      }
                      className="bg-slate-700 border-slate-600 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="block text-xs text-slate-400 mb-1">Max $</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={filters.maxPrice || ''}
                      onChange={(e) => 
                        updateFilters({ 
                          maxPrice: e.target.value ? parseFloat(e.target.value) : undefined 
                        })
                      }
                      className="bg-slate-700 border-slate-600 text-sm"
                      placeholder="100.00"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Keywords */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => toggleSection('keywords')}
              className="w-full justify-between text-slate-300 hover:text-white p-0"
            >
              <h3 className="text-sm font-medium">Keywords</h3>
              {expandedSections.keywords ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {expandedSections.keywords && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  {POPULAR_KEYWORDS.map((keyword) => (
                    <Label key={keyword} className="flex items-center space-x-1 text-xs">
                      <Checkbox
                        checked={(filters.keywords || []).includes(keyword.toLowerCase())}
                        onCheckedChange={() => toggleKeyword(keyword)}
                      />
                      <span>{keyword}</span>
                    </Label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator className="my-6 bg-slate-600" />


        </div>
      </aside>
    </>
  );
}
