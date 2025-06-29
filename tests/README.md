# Test Organization

## Test Categories

### Backend Tests
- **API Tests**: Test REST endpoints and responses
- **Database Tests**: Test schema, queries, and data integrity  
- **Integration Tests**: Test complete request-response flows
- **Unit Tests**: Test individual functions and modules

### Frontend Tests (Coming Soon)
- **Component Tests**: Test React components in isolation
- **Hook Tests**: Test custom React hooks
- **UI Tests**: Test user interactions and flows
- **Visual Tests**: Test UI appearance and layout

### E2E Tests
- **Full Stack Tests**: Test complete user journeys
- **Cross-Browser Tests**: Test compatibility across browsers
- **Performance Tests**: Test load times and responsiveness

## Running Tests

```bash
# Run all tests
npm run test

# Run specific test categories
npm run test:backend
npm run test:frontend  
npm run test:e2e

# Run tests with different cache modes
npm run test:no-cache
npm run test:session-cache
```

## Test File Naming Convention

- `*.test.js` - Unit/integration tests
- `*.e2e.js` - End-to-end tests  
- `*.spec.js` - Specification/behavior tests
- `test-*.js` - Utility test scripts