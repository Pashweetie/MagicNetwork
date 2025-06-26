# MagicNetwork System Architecture Analysis Framework

## Overview

This document provides a comprehensive framework for investigating the MagicNetwork frontend architecture. It serves as a roadmap for systematically mapping data flow, component relationships, and identifying architectural issues.

## Frontend Architecture Investigation

### Core Data Flow Components

#### 1. API Integration Layer
```
📁 client/src/lib/
├── api-client.ts              # Core API communication
├── scryfall-parser.ts         # Query parsing and transformation
└── utils/ (if exists)         # Utility functions
```

**Investigation Tasks:**
- [ ] **API Client Analysis**: How does frontend communicate with backend?
- [ ] **Request Formatting**: How are API requests built and sent?
- [ ] **Response Processing**: How are API responses processed and transformed?
- [ ] **Error Handling**: How are API errors handled and propagated?
- [ ] **Authentication**: How are authenticated requests handled?

**Key Questions:**
1. What data transformations happen in the API layer?
2. Are there schema mismatches between API responses and frontend expectations?
3. How is error handling implemented across API calls?
4. Are there any custom headers or authentication patterns?

#### 2. Data Fetching Hooks
```
📁 client/src/hooks/
├── use-scryfall.ts            # Search and card fetching
├── use-deck.ts                # Deck management
├── use-image-preloader.ts     # Image optimization
└── use-*.ts                   # All other data hooks
```

**Investigation Tasks:**
- [ ] **Hook Dependencies**: Which hooks depend on others?
- [ ] **Data Flow**: How data flows from hooks to components?
- [ ] **State Management**: How is state managed within hooks?
- [ ] **Cache Strategies**: How is data cached and invalidated?
- [ ] **Error Boundaries**: How are hook errors handled?

**Key Questions:**
1. Which hooks trigger automatic data fetching?
2. How do hooks coordinate with each other?
3. What are the enabled/disabled conditions for each hook?
4. How is loading and error state managed?

#### 3. Backend Services
```
📁 server/services/
├── card-database-service.ts   # Primary card data service
├── ai-recommendation-service.ts # AI/theme recommendations
└── *.ts                       # Other backend services
```

**Investigation Tasks:**
- [ ] **Service Architecture**: How are backend services structured?
- [ ] **Data Conversion**: Where does data get converted between formats?
- [ ] **Database Queries**: How are database queries built and executed?
- [ ] **Schema Mapping**: How database fields map to API responses?
- [ ] **Performance**: Are there performance bottlenecks?

**Key Questions:**
1. What is the exact schema mapping in `convertDbCardToCard`?
2. How are search queries built and optimized?
3. Where are theme-related services implemented?
4. What data validation and transformation occurs?

### Component Architecture Investigation

#### 1. Page-Level Components
```
📁 client/src/pages/
├── search.tsx                 # Main search interface
├── deck-builder.tsx (?)       # Deck building interface
└── *.tsx                      # Other page components
```

**Investigation Tasks:**
- [ ] **Page State Management**: How does each page manage state?
- [ ] **Component Composition**: How are components composed on each page?
- [ ] **Route Handling**: How do pages handle routing and navigation?
- [ ] **Data Requirements**: What data does each page need?
- [ ] **Side Effects**: What side effects occur on page load?

**Key Questions:**
1. Where does auto-search behavior originate?
2. How do pages coordinate multiple data sources?
3. What triggers component re-renders?
4. How is URL state synchronized with component state?

#### 2. Card Display Components
```
📁 client/src/components/
├── shared-card-tile.tsx       # Unified card display
├── dual-faced-card.tsx        # Dual face functionality
├── card-detail-modal.tsx      # Card detail modal
├── edhrec-recommendations.tsx # EDHREC-specific display
├── card-grid.tsx             # Card grid layout
└── *card*.tsx                # Other card-related components
```

**Investigation Tasks:**
- [ ] **Display Variants**: What are all the card display contexts?
- [ ] **Interaction Patterns**: How do users interact with cards?
- [ ] **Event Handling**: How are click/hover events managed?
- [ ] **State Coordination**: How do components share card state?
- [ ] **Styling Consistency**: Are styles consistent across contexts?

**Key Questions:**
1. Why do EDHREC and search use different display components?
2. How does modal opening interfere with dual face interactions?
3. What are all the card interaction patterns expected?
4. How can display components be unified?

#### 3. Search & Filter Components
```
📁 client/src/components/
├── filter-sidebar.tsx         # Search filters UI
├── search-bar.tsx (?)         # Search input
├── search-results.tsx (?)     # Results display
└── *search*.tsx              # Other search components
```

**Investigation Tasks:**
- [ ] **Filter State**: How is filter state managed and applied?
- [ ] **Search Coordination**: How do search and filters coordinate?
- [ ] **URL Synchronization**: How are filters reflected in URL?
- [ ] **Performance**: Are there unnecessary re-renders or API calls?
- [ ] **Validation**: How is user input validated?

**Key Questions:**
1. What triggers search execution?
2. How are filters applied to search queries?
3. Where does search state get initialized?
4. How are search results cached and managed?

#### 4. Theme System Components (To Be Discovered)
```
📁 client/src/components/ (Unknown structure)
├── *theme*.tsx               # Theme-related components
├── *suggestion*.tsx          # Theme suggestion components
├── *voting*.tsx              # Theme voting components
└── *recommendation*.tsx      # Theme recommendation displays
```

**Investigation Tasks:**
- [ ] **Component Discovery**: Find all theme-related components
- [ ] **Data Flow**: How does theme data flow through components?
- [ ] **API Integration**: How do theme components call backend?
- [ ] **State Management**: How is theme state managed?
- [ ] **User Interactions**: How do users interact with themes?

**Key Questions:**
1. Where are theme components implemented?
2. How do theme suggestions get displayed?
3. How does theme voting work?
4. How are themes integrated with card displays?

### Data Flow Mapping

#### 1. Search Data Flow
```
User Input → Search Hook → API Client → Backend Service → Database
     ↓             ↑            ↑             ↑            ↑
Search Page ← Component ← Response ← Data Service ← Query Results
```

**Investigation Points:**
- [ ] **Input Processing**: How user input becomes search parameters
- [ ] **Parameter Transformation**: How frontend params become backend queries
- [ ] **Data Conversion**: How database results become frontend objects
- [ ] **Component Updates**: How search results update UI components
- [ ] **Error Propagation**: How errors flow back to user interface

#### 2. Card Interaction Flow
```
User Click → Card Component → Event Handler → Modal/Action
     ↓              ↑              ↑             ↑
   Card UI ← Dual Face Logic ← Event Router ← State Update
```

**Investigation Points:**
- [ ] **Event Capturing**: Which components capture user interactions
- [ ] **Event Routing**: How events are routed to appropriate handlers
- [ ] **State Updates**: How interactions update component state
- [ ] **Side Effects**: What side effects occur from interactions
- [ ] **Conflict Resolution**: How modal and dual face interactions conflict

#### 3. Theme Data Flow (Unknown)
```
Theme Request → ? → ? → Theme Display
     ↓         ↑   ↑         ↑
Theme UI ← ? ← ? ← Theme Service
```

**Investigation Points:**
- [ ] **Theme Discovery**: Find complete theme data flow
- [ ] **API Endpoints**: What theme-related API endpoints exist
- [ ] **Component Integration**: How themes integrate with other components
- [ ] **State Management**: How theme state is managed
- [ ] **User Interactions**: How users interact with theme features

### Architecture Quality Assessment

#### 1. Code Organization Analysis
**File Structure Audit:**
- [ ] **Logical Grouping**: Are related components grouped logically?
- [ ] **Import Patterns**: Are there circular dependencies or complex imports?
- [ ] **Code Duplication**: Where is code duplicated across components?
- [ ] **Naming Conventions**: Are naming conventions consistent?
- [ ] **Component Size**: Are components appropriately sized?

#### 2. State Management Patterns
**State Flow Analysis:**
- [ ] **State Location**: Where is state stored (hooks, context, props)?
- [ ] **State Sharing**: How is state shared between components?
- [ ] **State Synchronization**: How is state kept synchronized?
- [ ] **State Updates**: How are state updates triggered and handled?
- [ ] **State Persistence**: What state persists across navigation?

#### 3. Performance Characteristics
**Performance Investigation:**
- [ ] **Render Cycles**: What triggers component re-renders?
- [ ] **API Call Patterns**: Are there unnecessary or duplicate API calls?
- [ ] **Memory Usage**: Are there memory leaks or excessive caching?
- [ ] **Bundle Size**: How large are component bundles?
- [ ] **Load Times**: How fast do components load and render?

### Investigation Methodology

#### Phase 1: File Discovery and Mapping
1. **Complete File Audit**: List all frontend files and their purposes
2. **Component Relationship Mapping**: How components depend on each other
3. **Data Flow Tracing**: Follow data from input to display
4. **API Endpoint Discovery**: Find all API integration points

#### Phase 2: Issue Root Cause Analysis
1. **Schema Mapping Investigation**: Trace data transformation issues
2. **Interaction Conflict Analysis**: Why modal blocks dual face functionality
3. **Theme System Discovery**: Find theme components and identify failures
4. **Auto-Search Investigation**: Why search triggers without user input

#### Phase 3: Architecture Design Validation
1. **Design Pattern Assessment**: Are consistent patterns used?
2. **Separation of Concerns**: Are responsibilities properly separated?
3. **Extensibility Analysis**: How easy is it to add new features?
4. **Maintainability Assessment**: How easy is the code to maintain?

### Expected Deliverables

#### 1. Architecture Documentation
- **Component Relationship Diagram**: Visual map of component dependencies
- **Data Flow Diagram**: How data moves through the system
- **API Integration Map**: All frontend-backend connection points
- **State Management Map**: How state is managed across components

#### 2. Issue Analysis Reports
- **Schema Mapping Report**: Detailed analysis of field mapping issues
- **Interaction Design Report**: Analysis of card interaction conflicts
- **Theme System Report**: Complete theme architecture analysis
- **Performance Analysis**: Identification of performance bottlenecks

#### 3. Quality Assessment
- **Code Quality Report**: Assessment of code organization and patterns
- **Technical Debt Analysis**: Identification of areas needing refactoring
- **Security Analysis**: Frontend security considerations
- **Accessibility Analysis**: UI accessibility assessment

### Investigation Tools and Techniques

#### 1. Static Code Analysis
- **File Search**: Find files by name patterns and content
- **Import Analysis**: Map import/export relationships
- **Code Pattern Search**: Find duplicated code patterns
- **Type Analysis**: Trace TypeScript type flow

#### 2. Runtime Analysis
- **Component Tree Inspection**: Analyze React component hierarchy
- **State Flow Tracing**: Follow state changes through components
- **API Call Monitoring**: Track API requests and responses
- **Performance Profiling**: Identify performance bottlenecks

#### 3. User Flow Analysis
- **Interaction Mapping**: Map all user interaction patterns
- **Event Flow Tracing**: Follow event propagation through components
- **State Change Analysis**: How user actions change application state
- **Error Flow Analysis**: How errors are handled and displayed

---

**Next Steps**: Use this framework to systematically investigate the MagicNetwork frontend architecture and create detailed implementation strategy.