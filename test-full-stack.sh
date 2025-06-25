#!/bin/bash
# Comprehensive Full-Stack Test Script
# Starts backend, frontend, runs tests, and shuts down cleanly

set -e  # Exit on any error

# Configuration
TIMEOUT=${TEST_TIMEOUT:-300}  # 5 minutes default timeout
BACKEND_PORT=5000
FRONTEND_PORT=5173
LOG_FILE="./tests/full-stack-test.log"

# Process tracking
BACKEND_PID=""
FRONTEND_PID=""
TEST_START_TIME=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] SUCCESS:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    log "🧹 Starting cleanup..."
    
    # Kill frontend if running
    if [ -n "$FRONTEND_PID" ]; then
        log "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill backend if running
    if [ -n "$BACKEND_PID" ]; then
        log "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on our ports
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    
    # Calculate total runtime
    if [ -n "$TEST_START_TIME" ]; then
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - TEST_START_TIME))
        log "📊 Total test runtime: ${DURATION}s"
    fi
    
    success "✅ Cleanup completed"
}

# Set up cleanup on exit
trap cleanup EXIT INT TERM

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    # Load .env file if it exists (same as start-dev.sh)
    if [ -f .env ]; then
        log "✅ .env file found"
        log "📁 Loading environment variables from .env file"
        export $(grep -v '^#' .env | xargs)
    else
        error "❌ .env file not found"
        return 1
    fi
    
    # Check database connection (same validation as start-dev.sh)
    if [ -n "$DATABASE_URL" ] && [ "$DATABASE_URL" != "your_database_url_here" ]; then
        log "✅ DATABASE_URL is properly configured"
    else
        error "❌ DATABASE_URL not properly configured"
        return 1
    fi
    
    # Check required commands
    for cmd in node npm npx lsof; do
        if ! command -v $cmd &> /dev/null; then
            error "❌ Required command not found: $cmd"
            return 1
        fi
    done
    
    success "✅ Prerequisites check passed"
}

# Wait for service to be ready
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=$3
    local attempt=1
    
    log "⏳ Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
            success "✅ $service_name is ready! (HTTP $http_code)"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts failed (HTTP $http_code), retrying in 2s..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    error "❌ $service_name failed to start within $((max_attempts * 2))s"
    return 1
}

# Start backend server
start_backend() {
    log "🚀 Starting backend server..."
    
    # Use the existing start-dev.sh script which handles environment variables
    ./start-dev.sh > ./tests/backend.log 2>&1 &
    
    BACKEND_PID=$!
    log "Backend started with PID: $BACKEND_PID"
    
    # Wait for backend to be ready
    wait_for_service "Backend" "http://localhost:$BACKEND_PORT/api/cards/search?query=test&limit=1" 20
}

# Start frontend server
start_frontend() {
    log "🎨 Starting frontend dev server..."
    
    # Start Vite dev server in background
    cd client && npx vite --port=$FRONTEND_PORT --host > ../tests/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    
    log "Frontend started with PID: $FRONTEND_PID"
    
    # Wait for frontend to be ready
    wait_for_service "Frontend" "http://localhost:$FRONTEND_PORT" 15
}

# Run API tests
run_api_tests() {
    log "🧪 Running API endpoint tests..."
    
    # Wait a bit for services to stabilize
    sleep 3
    
    # Run the existing API tests but against our running server
    log "Running: node tests/e2e.test.js"
    if timeout 30 node tests/e2e.test.js 2>&1 | tee ./tests/api-results.log; then
        success "✅ API tests passed"
        return 0
    else
        error "❌ API tests failed"
        if [ -f ./tests/api-results.log ]; then
            error "Last 10 lines of API test output:"
            tail -10 ./tests/api-results.log
        fi
        return 1
    fi
}

# Run frontend smoke tests
run_frontend_tests() {
    log "🌐 Running frontend smoke tests..."
    
    local frontend_url="http://localhost:$FRONTEND_PORT"
    local tests_passed=0
    local tests_total=0
    
    # Test 1: Homepage loads
    log "Testing homepage..."
    tests_total=$((tests_total + 1))
    if curl -s "$frontend_url" | grep -q "<!DOCTYPE html>"; then
        success "✅ Homepage loads correctly"
        tests_passed=$((tests_passed + 1))
    else
        error "❌ Homepage failed to load"
    fi
    
    # Test 2: Static assets load
    log "Testing static assets..."
    tests_total=$((tests_total + 1))
    if curl -s -o /dev/null -w "%{http_code}" "$frontend_url/src/main.tsx" | grep -q "200"; then
        success "✅ Static assets accessible"
        tests_passed=$((tests_passed + 1))
    else
        warn "⚠️ Some static assets may not be loading"
    fi
    
    # Test 3: Check for common errors in console
    log "Checking for critical frontend errors..."
    tests_total=$((tests_total + 1))
    if ! grep -i "error\|failed\|cannot" ./tests/frontend.log | head -5; then
        success "✅ No critical frontend errors detected"
        tests_passed=$((tests_passed + 1))
    else
        warn "⚠️ Some frontend errors detected (check frontend.log)"
    fi
    
    log "Frontend tests: $tests_passed/$tests_total passed"
    return $([ $tests_passed -eq $tests_total ] && echo 0 || echo 1)
}

# Run integration tests
run_integration_tests() {
    log "🔗 Running integration tests..."
    
    # Test full-stack integration by hitting frontend and checking API calls
    local integration_passed=true
    
    # Test that frontend can communicate with backend
    log "Testing frontend->backend communication..."
    
    # Simulate a search request that would come from frontend
    if curl -s \
        -H "Content-Type: application/json" \
        -H "x-user-id: test_integration_user" \
        "http://localhost:$BACKEND_PORT/api/cards/search?query=sol%20ring&limit=1" \
        | grep -q '"data"'; then
        success "✅ Frontend->Backend communication working"
    else
        error "❌ Frontend->Backend communication failed"
        integration_passed=false
    fi
    
    $integration_passed
}

# Generate test report
generate_report() {
    local exit_code=$1
    local end_time=$(date +%s)
    local duration=$((end_time - TEST_START_TIME))
    
    log "📊 Generating test report..."
    
    cat > ./tests/test-report.txt << EOF
# Full-Stack Test Report
Generated: $(date)
Duration: ${duration}s
Exit Code: $exit_code

## Test Results
$(if [ $exit_code -eq 0 ]; then echo "✅ ALL TESTS PASSED"; else echo "❌ SOME TESTS FAILED"; fi)

## Backend Log (last 20 lines):
$(tail -20 ./tests/backend.log 2>/dev/null || echo "No backend log available")

## Frontend Log (last 20 lines):
$(tail -20 ./tests/frontend.log 2>/dev/null || echo "No frontend log available")

## API Test Results:
$(cat ./tests/api-results.log 2>/dev/null || echo "No API test results available")

## Full Test Log:
$(cat ./tests/full-stack-test.log)
EOF
    
    success "📄 Test report saved to ./tests/test-report.txt"
}

# Main execution
main() {
    TEST_START_TIME=$(date +%s)
    
    # Create tests directory if it doesn't exist
    mkdir -p tests
    
    # Initialize log files
    touch "$LOG_FILE"
    touch "./tests/backend.log"
    touch "./tests/frontend.log" 
    touch "./tests/api-results.log"
    
    # Clear previous logs
    > "$LOG_FILE"
    > "./tests/backend.log"
    > "./tests/frontend.log"
    > "./tests/api-results.log"
    
    success "🧪 Starting Full-Stack Test Suite"
    success "⏰ Timeout: ${TIMEOUT}s"
    success "📝 Logs: $LOG_FILE"
    
    # Set up timeout
    (
        sleep $TIMEOUT
        error "⏰ Test suite timed out after ${TIMEOUT}s"
        kill $$ 2>/dev/null
    ) &
    local timeout_pid=$!
    
    local exit_code=0
    
    # Run the test sequence
    if check_prerequisites && \
       start_backend && \
       start_frontend && \
       run_api_tests && \
       run_frontend_tests && \
       run_integration_tests; then
        success "🎉 All tests passed successfully!"
        exit_code=0
    else
        error "💥 One or more tests failed"
        exit_code=1
    fi
    
    # Kill timeout process
    kill $timeout_pid 2>/dev/null || true
    
    # Generate report
    generate_report $exit_code
    
    return $exit_code
}

# Show help
show_help() {
    cat << EOF
Full-Stack Test Script for MagicNetwork

Usage: $0 [OPTIONS]

OPTIONS:
    -t, --timeout SECONDS    Set timeout in seconds (default: 300)
    -h, --help              Show this help message

ENVIRONMENT VARIABLES:
    TEST_TIMEOUT            Override default timeout
    
EXAMPLES:
    $0                      Run with default settings
    $0 -t 600              Run with 10-minute timeout
    TEST_TIMEOUT=120 $0    Run with 2-minute timeout

The script will:
1. Check prerequisites (.env file, database connection)
2. Start backend server on port $BACKEND_PORT
3. Start frontend dev server on port $FRONTEND_PORT  
4. Run API endpoint tests
5. Run frontend smoke tests
6. Run integration tests
7. Generate a comprehensive test report
8. Clean up all processes

All logs are saved to ./tests/ directory.
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main