# MTG Card Application - Project Context

## Overview
Magic: The Gathering deck building and card search application with advanced theme analysis and recommendation systems. Built with React frontend, Express backend, PostgreSQL database, and integrated AI-powered card theme generation.

## Recent Changes
- **2025-01-22**: Removed unnecessary theme generation during deck import to eliminate performance overhead and log spam
- **2025-01-22**: Implemented comprehensive edge caching system with Cloudflare integration for improved global performance
- **2025-01-22**: Added intelligent cache invalidation strategies and geographic optimization

## Architecture Decisions

### Edge Caching Strategy
- **Static Assets**: 1-year cache with immutable headers
- **Card Data**: 7-day cache with 1-day stale-while-revalidate
- **Search Results**: 1-hour cache with 30-minute stale-while-revalidate
- **Themes**: 24-hour cache with smart invalidation
- **User Data**: Private cache only, 5-minute TTL

### Performance Optimizations
- Cloudflare Workers for edge computing
- KV storage for frequently accessed data
- Geographic routing for global users
- Image optimization and lazy loading
- Intelligent cache warming

### Database Schema
- Cards table with comprehensive MTG data
- Theme system with AI-generated classifications
- User deck management with import/export
- Cache tables for search optimization

## User Preferences
- Clean, efficient code without unnecessary overhead
- Performance-focused architecture
- Comprehensive analysis before implementing fixes
- Professional communication without excessive explanations

## Technical Stack
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Cloudflare Workers, KV storage
- **AI**: Google Gemini for theme generation
- **External APIs**: Scryfall for card data, EDHREC for recommendations

## Key Features
- Advanced card search with Scryfall syntax support
- Deck import/export with multiple format support
- AI-powered theme analysis and recommendations
- EDHREC integration for meta analysis
- Global edge caching for optimal performance
- User session management with Replit Auth

## Development Guidelines
- Always analyze issues comprehensively before implementing fixes
- Prioritize performance and user experience
- Use TypeScript strictly for type safety
- Implement proper error handling and logging
- Follow REST API conventions
- Cache aggressively where appropriate