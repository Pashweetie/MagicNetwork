# MTG Card Search & Deck Builder - Architecture Overview

## Overview

This is a Magic: The Gathering card search and deck building application built with a modern web stack. The application provides powerful card search capabilities, AI-powered recommendations, and persistent deck building with automatic user tracking. It's optimized for deployment on Replit with optional Cloudflare integration for enhanced performance and security.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui
- **State Management**: React Query for server state, React hooks for local state
- **Routing**: Wouter (lightweight React router)
- **Build Tool**: Vite with custom configuration for Replit

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with validation
- **Database ORM**: Drizzle with PostgreSQL
- **Session Management**: Express sessions with PostgreSQL store
- **Authentication**: Automatic user token system (no manual login required)

## Key Components

### Database Schema
- **Cards Table**: Complete MTG card database with Scryfall data structure
- **Users**: Automatic user tracking with localStorage persistence
- **Decks**: Named deck storage with format support
- **User Decks**: Single deck per user for session continuity
- **Themes**: AI-generated card themes and recommendations
- **Sessions**: PostgreSQL-backed session storage

### Card Database
- **Source**: Scryfall API bulk data download
- **Size**: 95,000+ cards with complete metadata
- **Updates**: Automatic weekly updates with migration system
- **Search**: Full-text search with advanced filtering capabilities

### AI Integration
- **Providers**: Google Gemini (primary), DeepSeek, OpenAI (fallback)
- **Features**: Card theme generation, synergy recommendations
- **Themes**: Predefined theme system for consistency
- **Caching**: Theme persistence to reduce API calls

### Authentication System
- **Method**: Automatic anonymous user assignment
- **Storage**: localStorage for client persistence + server sessions
- **Flow**: Generate unique ID → Store locally → Send in headers
- **Benefits**: No signup friction, immediate deck building

## Data Flow

### Card Search Flow
1. User enters search query or applies filters
2. Query parsed using Scryfall syntax parser
3. Database query with optimized indexing
4. Results cached for performance
5. Images lazy-loaded with caching system

### Deck Building Flow
1. User adds cards to deck with quantity validation
2. Format rules applied (Commander singleton, Standard 4-of, etc.)
3. Changes saved to user_decks table automatically
4. Deck state synchronized between client and server
5. Optional export to standard deck formats

### AI Recommendation Flow
1. Card selected for recommendations
2. AI service generates themes based on card context
3. Database searched for synergistic cards
4. Results filtered by deck format restrictions
5. Recommendations cached to improve response time

## External Dependencies

### Required Services
- **PostgreSQL**: Primary database (auto-provisioned on Replit)
- **Node.js 20**: Runtime environment

### Optional AI Services
- **Google Gemini API**: Primary AI provider (free tier available)
- **DeepSeek API**: Alternative AI provider
- **OpenAI API**: Fallback AI provider

### Image Caching
- **Client-side**: IndexedDB for persistent image storage
- **Server-side**: Cloudflare CDN integration for global caching
- **Bandwidth**: 371MB+ saved through intelligent caching

## Deployment Strategy

### Replit Deployment (Primary)
- **Port**: 5000 (required by Replit)
- **Binding**: 0.0.0.0 for external access
- **Environment**: Automatic environment detection
- **URL**: `https://workspace.pashweetie.replit.app`
- **Features**: Built-in HTTPS, basic DDoS protection, auto-scaling

### Production Optimizations
- **Security Headers**: XSS, CSRF, clickjacking protection
- **Rate Limiting**: API route protection (100 req/min general, 50 req/min search)
- **Content Security**: HSTS, origin validation
- **Caching**: Aggressive static asset caching, API response caching

### Optional Cloudflare Integration
- **Benefits**: Advanced DDoS protection, global CDN, bot filtering
- **Setup**: Domain proxy configuration
- **Cache Tags**: Intelligent cache invalidation
- **Analytics**: Enhanced traffic monitoring

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://...

# Optional AI Features
GOOGLE_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
OPENAI_API_KEY=your_key

# Optional Session Security
SESSION_SECRET=your_secret
```

## Changelog

```
Changelog:
- June 24, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```