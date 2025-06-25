#!/bin/bash

# Docker Development Helper Script for MagicNetwork
# Provides easy commands for Docker development workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if .env file exists
check_env() {
    if [ ! -f ".env" ]; then
        log_error "No .env file found!"
        log_info "Copy example.env to .env and fill in your values:"
        log_info "cp example.env .env"
        exit 1
    fi
}

# Load environment variables
load_env() {
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
        log_success "Environment variables loaded"
    fi
}

# Show help
show_help() {
    echo "MagicNetwork Docker Development Helper"
    echo ""
    echo "Usage: ./docker-dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up              Start all services (backend + frontend)"
    echo "  down            Stop all services"
    echo "  restart         Restart all services"
    echo "  logs            Show logs from all services"
    echo "  logs-backend    Show backend logs only"
    echo "  logs-frontend   Show frontend logs only"
    echo "  build           Build all Docker images"
    echo "  clean           Clean up containers and images"
    echo "  test            Run comprehensive tests"
    echo "  shell-backend   Open shell in backend container"
    echo "  shell-frontend  Open shell in frontend container"
    echo "  status          Show container status"
    echo "  env-check       Verify environment setup"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./docker-dev.sh up          # Start development environment"
    echo "  ./docker-dev.sh logs        # Watch all logs"
    echo "  ./docker-dev.sh test        # Run tests in Docker"
}

# Main commands
case "${1:-help}" in
    "up")
        check_env
        log_info "Starting MagicNetwork development environment..."
        docker-compose up -d
        log_success "Services started!"
        log_info "Backend: http://localhost:${BACKEND_PORT:-5000}"
        log_info "Frontend: http://localhost:${FRONTEND_PORT:-5173}"
        log_info "Run './docker-dev.sh logs' to see logs"
        ;;
    
    "down")
        log_info "Stopping all services..."
        docker-compose down
        log_success "Services stopped"
        ;;
    
    "restart")
        log_info "Restarting services..."
        docker-compose restart
        log_success "Services restarted"
        ;;
    
    "logs")
        log_info "Showing logs from all services (Ctrl+C to exit)..."
        docker-compose logs -f
        ;;
    
    "logs-backend")
        log_info "Showing backend logs (Ctrl+C to exit)..."
        docker-compose logs -f backend
        ;;
    
    "logs-frontend")
        log_info "Showing frontend logs (Ctrl+C to exit)..."
        docker-compose logs -f frontend
        ;;
    
    "build")
        log_info "Building Docker images..."
        docker-compose build
        log_success "Images built successfully"
        ;;
    
    "clean")
        log_warning "This will remove all containers and images. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            log_info "Cleaning up Docker resources..."
            docker-compose down -v --rmi all --remove-orphans
            log_success "Cleanup complete"
        else
            log_info "Cleanup cancelled"
        fi
        ;;
    
    "test")
        check_env
        log_info "Running comprehensive tests in Docker..."
        docker-compose --profile testing up --build test-runner
        ;;
    
    "shell-backend")
        log_info "Opening shell in backend container..."
        docker-compose exec backend sh
        ;;
    
    "shell-frontend")
        log_info "Opening shell in frontend container..."
        docker-compose exec frontend sh
        ;;
    
    "status")
        log_info "Container status:"
        docker-compose ps
        ;;
    
    "env-check")
        check_env
        load_env
        log_success "Environment file found and loaded"
        log_info "Required variables:"
        echo "  DATABASE_URL: ${DATABASE_URL:0:20}..."
        echo "  SESSION_SECRET: ${SESSION_SECRET:+[SET]}${SESSION_SECRET:-[NOT SET]}"
        echo "  AI API Keys: ${OPENAI_API_KEY:+OpenAI}${GOOGLE_API_KEY:+ Google}${DEEPSEEK_API_KEY:+ DeepSeek}"
        ;;
    
    "help"|*)
        show_help
        ;;
esac