import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Card } from '@shared/schema'

// Create a test-specific query client
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  }
}

// Mock card data for testing
export const mockCard: Card = {
  id: '92b8fe7c-fe36-4f6d-9c7f-85286b745865',
  oracle_id: '2c7c42e1-b097-4443-aa02-1f1dfcbb9732',
  name: 'Arc Blade',
  mana_cost: '{3}{R}{R}',
  cmc: 5,
  type_line: 'Sorcery',
  oracle_text: 'Arc Blade deals 2 damage to any target. Exile Arc Blade with three time counters on it.\nSuspend 3—{2}{R}',
  colors: ['R'],
  color_identity: ['R'],
  rarity: 'uncommon',
  set: 'fut',
  set_name: 'Future Sight',
  image_uris: {
    normal: 'https://cards.scryfall.io/normal/front/9/2/92b8fe7c-fe36-4f6d-9c7f-85286b745865.jpg',
    large: 'https://cards.scryfall.io/large/front/9/2/92b8fe7c-fe36-4f6d-9c7f-85286b745865.jpg'
  },
  prices: { usd: '0.25' },
  legalities: {
    standard: 'not_legal',
    modern: 'legal',
    legacy: 'legal',
    commander: 'legal'
  }
}

// Mock theme data
export const mockThemeGroups = [
  {
    theme: 'Burn',
    description: 'Direct damage spells and effects',
    confidence: 85,
    cards: []
  },
  {
    theme: 'Removal', 
    description: 'Creature and permanent removal',
    confidence: 75,
    cards: []
  }
]

// Helper to wait for queries to settle
export async function waitForQueriesToSettle(queryClient: QueryClient) {
  await queryClient.getQueryCache().getAll().forEach(query => {
    if (query.state.fetchStatus !== 'idle') {
      return query.promise
    }
  })
}

// Helper to create mock functions with TypeScript support  
export const createMockFn = <T extends (...args: any[]) => any>(
  impl?: T
) => {
  return (globalThis as any).vi?.fn(impl) || (() => {})
}

// Re-export everything from testing library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'