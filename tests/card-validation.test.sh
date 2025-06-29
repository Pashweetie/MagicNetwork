#!/bin/bash

# MagicNetwork Card Data Validation Test
# Tests API responses for data integrity across various card types and edge cases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
API_BASE="http://localhost:5000"
SAMPLE_SIZE=100

# Standard test card IDs - these should be consistent across test runs
# Mix of different card types, rarities, and edge cases
STANDARD_TEST_CARDS=(
    "5aa90ab6-2686-4462-8725-5d4370c05437"  # _____ (creature with unusual name)
    "dd52d0bd-3abd-401c-9f56-ee911613da3b"  # Acererak the Archlich (legendary)
    "b443504e-1b25-4565-bad7-2575826c7bb9"  # A-Alrund, God of the Cosmos // A-Hakka, Whispering Raven (double-faced)
    "df2f81dc-2346-4bd9-aa3b-aaa2d3873415"  # A-Alrund's Epiphany (sorcery)
    "63c82bef-50d6-4d25-bc3f-dda2826fc99c"  # Abduction (enchantment aura)
    "a5cbda07-53a0-4526-9955-36f902073cf1"  # A-Earthquake Dragon (arena card)
    "0eec9984-cd11-4a52-9234-469c6a5fb9aa"  # Abandoned Campground (land)
    "c9f1fc97-00c0-492b-a4a3-b179afc2f95d"  # Abaddon the Despoiler (multicolored)
    "51889b3f-082a-40e9-8be7-11f8c1a7a9a8"  # Aboleth Spawn (horror creature)
    "a363bc91-8278-448e-9d5c-564e4b51eb62"  # Abomination (old card)
)

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

# Validation functions
validate_required_fields() {
    local response="$1"
    local test_name="$2"
    
    local null_oracle_ids=$(echo "$response" | jq '[.data[] | select(.oracle_id == null)] | length')
    local null_names=$(echo "$response" | jq '[.data[] | select(.name == null)] | length')
    local null_ids=$(echo "$response" | jq '[.data[] | select(.id == null)] | length')
    
    if [ "$null_oracle_ids" -gt 0 ]; then
        log_error "$test_name: Found $null_oracle_ids cards with null oracle_id"
        return 1
    fi
    
    if [ "$null_names" -gt 0 ]; then
        log_error "$test_name: Found $null_names cards with null name"
        return 1
    fi
    
    if [ "$null_ids" -gt 0 ]; then
        log_error "$test_name: Found $null_ids cards with null id"
        return 1
    fi
    
    log_success "$test_name: All required fields populated"
    return 0
}

# Test functions
test_creature_filter() {
    log_info "Testing creature filter with $SAMPLE_SIZE cards..."
    local response=$(curl -s "$API_BASE/api/cards/search?types=creature&limit=$SAMPLE_SIZE")
    
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        log_error "Creature filter: Invalid JSON response"
        return 1
    fi
    
    local card_count=$(echo "$response" | jq '.data | length')
    log_info "Retrieved $card_count creature cards"
    
    validate_required_fields "$response" "Creature Filter"
}

test_instant_filter() {
    log_info "Testing instant filter with $SAMPLE_SIZE cards..."
    local response=$(curl -s "$API_BASE/api/cards/search?types=instant&limit=$SAMPLE_SIZE")
    
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        log_error "Instant filter: Invalid JSON response"
        return 1
    fi
    
    local card_count=$(echo "$response" | jq '.data | length')
    log_info "Retrieved $card_count instant cards"
    
    validate_required_fields "$response" "Instant Filter"
}

test_land_filter() {
    log_info "Testing land filter with $SAMPLE_SIZE cards..."
    local response=$(curl -s "$API_BASE/api/cards/search?types=land&limit=$SAMPLE_SIZE")
    
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        log_error "Land filter: Invalid JSON response"
        return 1
    fi
    
    local card_count=$(echo "$response" | jq '.data | length')
    log_info "Retrieved $card_count land cards"
    
    validate_required_fields "$response" "Land Filter"
    
    # Special validation for lands - some may not have oracle text
    local cards_with_text=$(echo "$response" | jq '[.data[] | select(.oracle_text != null)] | length')
    local cards_without_text=$(echo "$response" | jq '[.data[] | select(.oracle_text == null)] | length')
    log_info "Land cards: $cards_with_text with oracle text, $cards_without_text without"
}

test_multicolor_filter() {
    log_info "Testing multicolor filter..."
    local response=$(curl -s "$API_BASE/api/cards/search?colors=red,blue&limit=50")
    
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        log_error "Multicolor filter: Invalid JSON response"
        return 1
    fi
    
    local card_count=$(echo "$response" | jq '.data | length')
    log_info "Retrieved $card_count multicolor cards"
    
    validate_required_fields "$response" "Multicolor Filter"
}

test_standard_cards() {
    log_info "Testing standard test card list..."
    local failed_cards=0
    
    for card_id in "${STANDARD_TEST_CARDS[@]}"; do
        local response=$(curl -s "$API_BASE/api/cards/$card_id")
        
        if ! echo "$response" | jq . >/dev/null 2>&1; then
            log_error "Card $card_id: Invalid JSON response"
            ((failed_cards++))
            continue
        fi
        
        local name=$(echo "$response" | jq -r '.name // "null"')
        local oracle_id=$(echo "$response" | jq -r '.oracle_id // "null"')
        
        if [ "$name" = "null" ] || [ "$oracle_id" = "null" ]; then
            log_error "Card $card_id: Missing required fields (name: $name, oracle_id: $oracle_id)"
            ((failed_cards++))
        else
            log_success "Card $card_id: $name - OK"
        fi
    done
    
    if [ $failed_cards -gt 0 ]; then
        log_error "Standard cards test: $failed_cards cards failed validation"
        return 1
    else
        log_success "Standard cards test: All ${#STANDARD_TEST_CARDS[@]} cards passed"
        return 0
    fi
}

test_pagination() {
    log_info "Testing pagination with large dataset..."
    local response=$(curl -s "$API_BASE/api/cards/search?page=1&limit=200")
    
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        log_error "Pagination: Invalid JSON response"
        return 1
    fi
    
    local has_more=$(echo "$response" | jq '.has_more')
    local card_count=$(echo "$response" | jq '.data | length')
    
    log_info "Page 1: $card_count cards, has_more: $has_more"
    
    validate_required_fields "$response" "Pagination Test"
}

# Main test execution
main() {
    echo "==================================="
    echo "MagicNetwork Card Data Validation"
    echo "==================================="
    echo ""
    
    local total_tests=0
    local passed_tests=0
    
    # Test creature filter (the original issue)
    ((total_tests++))
    if test_creature_filter; then ((passed_tests++)); fi
    echo ""
    
    # Test other card types
    ((total_tests++))
    if test_instant_filter; then ((passed_tests++)); fi
    echo ""
    
    ((total_tests++))
    if test_land_filter; then ((passed_tests++)); fi
    echo ""
    
    ((total_tests++))
    if test_multicolor_filter; then ((passed_tests++)); fi
    echo ""
    
    # Test standardized card list
    ((total_tests++))
    if test_standard_cards; then ((passed_tests++)); fi
    echo ""
    
    # Test pagination
    ((total_tests++))
    if test_pagination; then ((passed_tests++)); fi
    echo ""
    
    # Summary
    echo "==================================="
    echo "Test Summary"
    echo "==================================="
    log_info "Total tests: $total_tests"
    log_success "Passed: $passed_tests"
    
    if [ $passed_tests -eq $total_tests ]; then
        log_success "ALL TESTS PASSED! 🎉"
        exit 0
    else
        local failed=$((total_tests - passed_tests))
        log_error "Failed: $failed"
        log_error "Some tests failed. Check the API and database integrity."
        exit 1
    fi
}

# Check if API is available
if ! curl -s "$API_BASE/api/cards/search?limit=1" >/dev/null; then
    log_error "API not available at $API_BASE"
    log_info "Make sure the backend is running with: ./docker-dev.sh up"
    exit 1
fi

main "$@"