# MTG Card Search & Deck Builder

A powerful Magic: The Gathering card search and deck building application with automatic user tracking and Cloudflare protection.

## Features

- **Card Search**: Search through 95,000+ MTG cards with advanced filters
- **Deck Building**: Build and save decks with persistent user tracking
- **AI Recommendations**: Get card suggestions based on themes and synergies
- **Image Caching**: Efficient bandwidth usage with 362MB+ saved
- **Authentication**: Automatic user tracking without manual login
- **Cloudflare Ready**: Pre-configured for enterprise protection

## Quick Start

### Basic Development
```bash
npm install
npm run dev
```
Access at: `http://localhost:5000`

### With Cloudflare Tunnel
```bash
# First-time setup (see cloudflare-setup.md for details)
cloudflared tunnel login
cloudflared tunnel create mtg-app
# Edit cloudflare-tunnel.yml with your tunnel ID

# Run with auto-tunnel
npm run dev:tunnel
```

## Scripts

- `npm run dev` - Start development server
- `npm run dev:tunnel` - Start with Cloudflare tunnel auto-enabled
- `npm run tunnel` - Manual tunnel setup script
- `npm run db:push` - Update database schema

## Architecture

### Authentication
- Automatic user token assignment
- Client-side persistence via localStorage
- Session-based tracking for deck continuity
- No manual login required

### Database
- PostgreSQL with Drizzle ORM
- Automatic schema migrations
- Card caching for performance
- User deck persistence

### Cloudflare Integration
- DDoS protection and rate limiting
- Global CDN for card images
- Bot filtering and analytics
- Zero-downtime deployment ready

## Configuration Files

- `cloudflare-tunnel.yml` - Tunnel configuration
- `cloudflare-setup.md` - Setup instructions
- `cloudflare-rules.md` - Security and caching rules
- `drizzle.config.ts` - Database configuration

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - Database credentials

Optional:
- `CLOUDFLARE_TUNNEL_ID` - Your tunnel ID for named tunnels
- `CLOUDFLARE_CONNECTOR_ID` - Your connector ID for connector-based tunnels
- `NODE_ENV=development` - Development mode

Note: If no Cloudflare credentials are provided, a quick tunnel will be started automatically.

## API Endpoints

### Card Search
- `GET /api/cards/search` - Search cards with filters
- `GET /api/cards/:id` - Get single card details
- `GET /api/cards/random` - Get random card

### Deck Management
- `GET /api/user/deck` - Get user's deck
- `PUT /api/user/deck` - Save deck changes
- `POST /api/user/deck/import` - Import deck from text

### Recommendations
- `GET /api/cards/:id/recommendations` - Get card recommendations
- `GET /api/cards/:id/theme-suggestions` - Get theme-based suggestions

## Custom Domain Setup

1. Purchase domain and add to Cloudflare
2. Update `cloudflare-tunnel.yml` hostname
3. Configure DNS records in Cloudflare dashboard
4. Update any hardcoded URLs in client code

See `cloudflare-setup.md` for detailed instructions.

## Performance

- **Image Caching**: 100% hit rate, 362MB+ bandwidth saved
- **Database**: Optimized queries with indexing
- **CDN**: Global distribution via Cloudflare
- **Compression**: Brotli and gzip enabled

## Security

- All API routes require authentication
- Rate limiting via Cloudflare
- Bot protection and DDoS mitigation
- Secure headers and HTTPS enforcement

## Development

Built with:
- **Frontend**: React, TypeScript, TailwindCSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL, Drizzle ORM
- **Deployment**: Replit + Cloudflare
- **Build**: Vite, ESBuild