import { http, HttpResponse } from 'msw'

// Mock data
const mockCard = {
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

const mockThemeGroups = [
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
  },
  {
    theme: 'Suspend',
    description: 'Time-based mechanics',
    confidence: 65,
    cards: []
  }
]

export const handlers = [
  // Theme suggestions API
  http.get('/api/cards/:id/theme-suggestions', ({ params }) => {
    return HttpResponse.json({
      themeGroups: mockThemeGroups,
      userVotes: []
    })
  }),

  // Card search API
  http.get('/api/cards/search', ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query')
    const filters = url.searchParams.get('filters')
    
    return HttpResponse.json({
      data: query ? [mockCard] : [],
      has_more: false,
      total_cards: query ? 1 : 0
    })
  }),

  // Individual card fetch
  http.get('/api/cards/:id', ({ params }) => {
    if (params.id === mockCard.id) {
      return HttpResponse.json(mockCard)
    }
    return new HttpResponse(null, { status: 404 })
  }),

  // Theme voting
  http.post('/api/cards/:id/theme-vote', ({ request, params }) => {
    return HttpResponse.json({
      success: true,
      newScore: 80,
      message: 'Vote recorded successfully'
    })
  }),

  // Error simulation for testing
  http.get('/api/cards/error-test', () => {
    return new HttpResponse(null, { status: 500 })
  })
]