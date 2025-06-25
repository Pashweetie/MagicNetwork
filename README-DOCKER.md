# MagicNetwork Docker Setup

This Docker setup provides a containerized development environment for MagicNetwork that runs alongside your existing Replit deployment without affecting it.

## Quick Start

1. **Copy environment variables**:
   ```bash
   cp example.env .env
   # Edit .env with your actual values
   ```

2. **Start development environment**:
   ```bash
   ./docker-dev.sh up
   ```

3. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

## Available Commands

```bash
./docker-dev.sh up              # Start all services
./docker-dev.sh down            # Stop all services
./docker-dev.sh logs            # View all logs
./docker-dev.sh test            # Run comprehensive tests
./docker-dev.sh status          # Check container status
./docker-dev.sh help            # See all commands
```

## Services

- **Backend**: Node.js/Express API server with hot reload
- **Frontend**: React/Vite dev server with HMR
- **Test Runner**: Comprehensive API and database validation tests

## Development Workflow

### Option 1: Replit (Unchanged)
```bash
npm run dev  # Works exactly as before
```

### Option 2: Local Docker
```bash
./docker-dev.sh up     # Start containerized environment
./docker-dev.sh logs   # Watch development logs
```

### Option 3: Hybrid
- Edit code in Replit web editor
- Test locally with Docker for complex debugging
- Deploy through Replit as usual

## Testing

Run comprehensive tests in Docker:
```bash
./docker-dev.sh test
```

Tests include:
- All API endpoints (comprehensive-api.test.js)
- Database validation (database-validation.test.js)
- Integration testing with real cloud database

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   React/Vite    │───▶│   Node/Express  │
│   Port 5173     │    │   Port 5000     │
└─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Cloud Database │
                       │   PostgreSQL    │
                       └─────────────────┘
```

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - Your cloud PostgreSQL connection
- `SESSION_SECRET` - Random session secret
- AI API keys (at least one recommended)

## No Impact on Replit

This Docker setup:
- ✅ Doesn't modify `package.json` scripts
- ✅ Doesn't touch Replit configuration  
- ✅ Uses same cloud database
- ✅ Leaves existing workflows intact
- ✅ Provides additional development option

## Troubleshooting

**Services won't start**:
```bash
./docker-dev.sh env-check  # Verify environment setup
./docker-dev.sh clean      # Clean up and rebuild
```

**Tests failing**:
```bash
./docker-dev.sh logs-backend  # Check backend logs
```

**Database connection issues**:
- Verify `DATABASE_URL` in `.env`
- Ensure cloud database allows connections
- Check network connectivity

## File Structure

```
docker/
├── backend/Dockerfile       # Backend container config
├── frontend/Dockerfile      # Frontend container config
└── test-package.json        # Docker-specific test scripts

docker-compose.yml           # Service orchestration
docker-dev.sh               # Development helper script
.dockerignore               # Files to exclude from containers
```