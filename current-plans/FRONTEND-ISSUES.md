# MagicNetwork Frontend Issues - Comprehensive Mapping

## Overview

This document provides a detailed catalog of all identified systematic issues in the MagicNetwork frontend. Each issue is analyzed with root cause, impact, and investigation requirements.

## Critical Issues (Must Fix First)

### 🔴 Issue 1: Schema Field Mapping Crisis

#### **Problem Statement**
Database stores card fields using camelCase naming convention (`manaCost`, `typeLine`, `oracleText`), but frontend code expects snake_case naming (`mana_cost`, `type_line`, `oracle_text`).

#### **Root Cause**
The `convertDbCardToCard` method in `server/services/card-database-service.ts` (lines 384-410) attempts to access database fields using snake_case property names, but the actual database schema uses camelCase.

#### **Evidence**
```typescript
// Database Schema (shared/schema.ts - camelCase)
export const cards = pgTable('cards', {
  manaCost: text('mana_cost'),     // Database field is camelCase
  typeLine: text('type_line'),     // Database field is camelCase
  oracleText: text('oracle_text'), // Database field is camelCase
  // ...
});

// Conversion Method (card-database-service.ts - expects snake_case)
private convertDbCardToCard(dbCard: any): Card {
  return {
    mana_cost: dbCard.mana_cost,     // ❌ WRONG - should be dbCard.manaCost
    type_line: dbCard.type_line,     // ❌ WRONG - should be dbCard.typeLine
    oracle_text: dbCard.oracle_text, // ❌ WRONG - should be dbCard.oracleText
    // ...
  };
}
```

#### **Impact Assessment**
- **Severity**: Critical - Complete search failure
- **Scope**: All card display functionality
- **User Experience**: Search returns empty results, cards don't display
- **Affected Components**: Every component that displays card data
- **API Endpoints**: All card-related API responses broken

#### **Files Affected**
- `server/services/card-database-service.ts` - Primary fix location
- `shared/schema.ts` - Schema definition reference
- All frontend components consuming card data
- All search and filter functionality

#### **Investigation Requirements**
1. **Audit Database Schema**: Confirm exact field names in database
2. **Map All Field References**: Find every place schema fields are referenced
3. **Test Data Flow**: Verify data from database to frontend display
4. **Impact Analysis**: Identify all components affected by schema mismatch

---

### 🔴 Issue 2: Card Interaction Blocking

#### **Problem Statement**
Dual face cards cannot be flipped or properly interacted with because clicking anywhere on a card opens the detail modal, preventing dual face flip functionality from working.

#### **Root Cause**
Card click handlers are too broad - the entire card area triggers modal opening, which prevents dual face flip buttons and hover effects from functioning.

#### **Evidence**
```typescript
// In SharedCardTile component - entire card is clickable
<div 
  className="group cursor-pointer transform hover:scale-110 hover:z-20 transition-transform duration-200"
  onClick={() => onClick(card)}  // ❌ Entire card opens modal
>
  {/* Dual face flip button inside here can never be clicked */}
  <DualFacedCard card={card} />
</div>
```

#### **Impact Assessment**
- **Severity**: Critical - Core functionality broken
- **Scope**: All dual face cards (transform, flip, adventure, modal DFCs)
- **User Experience**: Users cannot see both sides of dual face cards
- **Affected Components**: All card display contexts where dual faces should work

#### **Current Dual Face Implementation**
```typescript
// DualFacedCard component has flip button, but it's blocked
{showFlipButton && faces.length > 1 && (
  <Button onClick={flipCard}>  // ❌ Never triggers due to modal intercept
    <RotateCcw className="w-3 h-3 mr-1" />
    Flip
  </Button>
)}
```

#### **Files Affected**
- `client/src/components/shared-card-tile.tsx` - Main card click handling
- `client/src/components/dual-faced-card.tsx` - Dual face functionality
- `client/src/components/card-detail-modal.tsx` - Modal trigger behavior
- All card display contexts (search, EDHREC, deck building)

#### **Investigation Requirements**
1. **Map Click Event Flow**: Trace how clicks propagate through card components
2. **Analyze Event Handlers**: Which components handle which click events
3. **Test Dual Face Logic**: Verify flip functionality works in isolation
4. **Design Solution**: How to allow both modal AND dual face interactions

---

### 🔴 Issue 3: Broken Themes System

#### **Problem Statement**
The themes system is completely non-functional. Theme suggestions, theme voting, and theme displays are all broken.

#### **Root Cause**
Unknown - requires comprehensive investigation to identify where theme system is failing.

#### **Evidence**
User reports that "themes aren't working" - specific manifestations need to be discovered through investigation.

#### **Impact Assessment**
- **Severity**: Critical - Major feature completely broken
- **Scope**: All theme-related functionality (unknown extent)
- **User Experience**: Core feature unavailable
- **Business Impact**: Key differentiating feature not working

#### **Investigation Requirements**
1. **Discover Theme Architecture**: Find all theme-related files and components
2. **Map Theme Data Flow**: How theme data moves from backend to frontend
3. **Test Theme APIs**: Verify theme-related backend endpoints work
4. **Analyze Theme Components**: Check theme UI components for issues
5. **Identify Failure Points**: Where exactly theme system is breaking

#### **Expected Theme Components** (to be discovered)
```
// Likely theme-related files (need to find these)
client/src/components/*theme*
client/src/hooks/use-themes.ts (?)
client/src/pages/*theme* (?)
server/routes/*theme* (?)
```

#### **Theme Functionality Expected**
- Theme suggestions for cards
- Theme voting (upvote/downvote themes)
- Theme display in UI
- Theme-based card recommendations
- Theme management and curation

---

## High Priority Issues

### 🟡 Issue 4: Auto-Search Behavior

#### **Problem Statement**
Search executes automatically on page load without user input, causing unnecessary API calls and confusing UX.

#### **Root Cause**
The `useCardSearch` hook is called without proper `enabled` conditions, causing it to execute immediately.

#### **Evidence**
```typescript
// In search.tsx - search executes without user input
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetching,
  // ...
} = useCardSearch(showEdhrecResults ? {} : activeFilters); // ❌ No enabled condition
```

#### **Impact Assessment**
- **Severity**: High - Poor UX and wasted resources
- **Scope**: Search page initialization
- **User Experience**: Confusing, unexpected search results on page load
- **Performance**: Unnecessary API calls and database queries

#### **Files Affected**
- `client/src/pages/search.tsx` - Main search hook call
- `client/src/hooks/use-scryfall.ts` - Search hook definition

#### **Investigation Requirements**
1. **Trace Search Triggers**: Find all places search can be triggered
2. **Analyze Enabled Conditions**: What should prevent auto-search
3. **Test Search Flow**: Verify search only runs when user intends
4. **Check Default States**: Ensure clean initial state

---

### 🟡 Issue 5: Display System Fragmentation

#### **Problem Statement**
EDHREC recommendations and normal search results use completely different card display patterns, creating inconsistent UX and code duplication.

#### **Root Cause**
Different components were built for EDHREC vs search without unified design system.

#### **Evidence**
```typescript
// Search uses SharedCardTile
<SharedCardTile variant="search" card={card} onClick={onClick} />

// EDHREC uses custom EdhrecCardDisplay
<div className="flex items-center space-x-3 p-3 bg-slate-800/50...">
  {/* Completely different layout and styling */}
</div>
```

#### **Impact Assessment**
- **Severity**: Medium - UX inconsistency and maintenance overhead
- **Scope**: All card display contexts
- **User Experience**: Confusing inconsistent interfaces
- **Maintenance**: Duplicate code, harder to maintain

#### **Files Affected**
- `client/src/components/shared-card-tile.tsx` - Search card display
- `client/src/components/edhrec-recommendations.tsx` - EDHREC card display
- All other card display contexts

#### **Investigation Requirements**
1. **Map All Display Contexts**: Find every place cards are displayed
2. **Analyze Display Patterns**: What's common vs different
3. **Design Unified System**: How to create consistent display
4. **Plan Migration**: How to transition to unified system

---

### 🟡 Issue 6: Duplicate Card Printings

#### **Problem Statement**
Search results show multiple printings of the same card instead of deduplicating to show the best/cheapest version.

#### **Root Cause**
The search query in `card-database-service.ts` attempts deduplication but may have logical issues.

#### **Evidence**
```typescript
// Current deduplication logic
const cheapestCardsQuery = `
  WITH ranked_cards AS (
    SELECT *,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(oracle_id, name) 
        ORDER BY 
          CASE 
            WHEN prices->>'usd' IS NOT NULL AND prices->>'usd' ~ '^[0-9]+(\\.[0-9]+)?$' 
            THEN CAST(prices->>'usd' AS DECIMAL)
            ELSE 999999 
          END ASC,
          released_at DESC
      ) as price_rank
    FROM cards
    ${whereClause}
  )
  SELECT * FROM ranked_cards 
  WHERE price_rank = 1
`;
```

#### **Impact Assessment**
- **Severity**: Medium - Cluttered search results
- **Scope**: Search functionality
- **User Experience**: Confusing duplicate results
- **Performance**: More results than necessary

#### **Files Affected**
- `server/services/card-database-service.ts` - Deduplication logic

#### **Investigation Requirements**
1. **Test Deduplication**: Verify if logic works correctly
2. **Analyze Edge Cases**: Cards without oracle_id or prices
3. **Check Sort Logic**: Ensure best versions are selected
4. **Validate Results**: Compare deduplicated vs raw results

---

## Medium Priority Issues

### 🟠 Issue 7: Filter Logic Inconsistencies

#### **Problem Statement**
Some search filters may not work correctly due to schema field mapping issues.

#### **Root Cause**
Filter queries may be using incorrect field names due to schema mapping crisis.

#### **Evidence**
```typescript
// Filter building in searchCards method
if (filters.types && filters.types.length > 0) {
  const typeFilters = filters.types.map(type => `type_line ILIKE '%${type}'`);
  // Uses snake_case in query, but may need to match database schema
}
```

#### **Impact Assessment**
- **Severity**: Medium - Some filters don't work
- **Scope**: Filter functionality
- **User Experience**: Filters don't produce expected results
- **Discovery**: Need to test each filter individually

#### **Files Affected**
- `server/services/card-database-service.ts` - Filter query building
- `client/src/components/filter-sidebar.tsx` - Filter UI
- `client/src/hooks/use-scryfall.ts` - Filter parameter passing

#### **Investigation Requirements**
1. **Test Each Filter**: Verify every filter works correctly
2. **Check Field Names**: Ensure filter queries use correct database fields
3. **Validate Filter Logic**: Confirm filter combinations work
4. **Test Edge Cases**: Empty filters, multiple selections, etc.

---

## Investigation Strategy by Component

### Data Flow Components
```
🔍 PRIORITY 1: Core Data Flow
client/src/hooks/use-scryfall.ts        # Search and card fetching
client/src/lib/api-client.ts            # API integration layer
server/services/card-database-service.ts # Backend data service
shared/schema.ts                        # Type definitions

🔍 PRIORITY 2: Search System  
client/src/pages/search.tsx             # Main search interface
client/src/components/filter-sidebar.tsx # Filter UI
client/src/lib/scryfall-parser.ts       # Query parsing

🔍 PRIORITY 3: Card Display
client/src/components/shared-card-tile.tsx      # Main card display
client/src/components/dual-faced-card.tsx       # Dual face functionality
client/src/components/card-detail-modal.tsx     # Modal interactions
client/src/components/edhrec-recommendations.tsx # EDHREC display

🔍 PRIORITY 4: Theme System (Unknown Files)
// Need to discover theme-related files through investigation
```

### Investigation Workflow

#### Phase 1: Critical Data Flow
1. **Schema Mapping**: Fix `convertDbCardToCard` method
2. **Search Auto-Trigger**: Add proper enabled conditions
3. **Basic Functionality**: Ensure search returns valid results

#### Phase 2: Interaction Design
1. **Card Click Handling**: Redesign to allow dual face + modal
2. **Dual Face Functionality**: Enable hover/click flipping
3. **Theme System Discovery**: Find and fix theme components

#### Phase 3: Experience Optimization
1. **Display Unification**: Create consistent card display
2. **Filter Validation**: Test and fix all filters
3. **Deduplication**: Improve search result quality

---

## Success Validation Criteria

### ✅ Critical Issues Resolved
- [ ] Search returns card results with correct data
- [ ] Dual face cards flip on hover/click without blocking modal
- [ ] Theme system fully functional (suggestions, voting, display)
- [ ] No auto-search on page load

### ✅ High Priority Issues Resolved  
- [ ] Consistent card display across all contexts
- [ ] All search filters work correctly
- [ ] Duplicate card printings eliminated
- [ ] Clean, intuitive interaction patterns

### ✅ System Quality Improved
- [ ] No code duplication in display components
- [ ] Clear, documented architecture
- [ ] Comprehensive test coverage
- [ ] Performance optimized (no unnecessary API calls)

---

**Next**: Create system architecture analysis and implementation strategy documents.