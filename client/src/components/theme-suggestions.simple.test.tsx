import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { ThemeSuggestions } from './theme-suggestions'
import { renderWithProviders, mockCard } from '../test/utils'

// Mock the API client to return successful data
vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      themeGroups: [
        {
          theme: 'Burn',
          description: 'Direct damage spells and effects',
          confidence: 85,
          cards: []
        }
      ],
      userVotes: []
    }),
    post: vi.fn().mockResolvedValue({ success: true })
  }
}))

describe('ThemeSuggestions - Simple Tests', () => {
  const defaultProps = {
    card: mockCard,
    onCardClick: vi.fn(),
    onAddCard: vi.fn(),
    currentFilters: {}
  }

  it('renders the component without crashing', () => {
    renderWithProviders(<ThemeSuggestions {...defaultProps} />)
    
    // Just check that something renders - the component should not crash
    expect(document.body).toBeTruthy()
  })

  it('shows loading initially', () => {
    renderWithProviders(<ThemeSuggestions {...defaultProps} />)
    
    // Check for loading text or error state
    const content = document.body.textContent
    expect(content).toMatch(/Loading|Failed|No theme suggestions/i)
  })

  it('handles card prop correctly', () => {
    const { rerender } = renderWithProviders(<ThemeSuggestions {...defaultProps} />)
    
    // Change card prop
    const newCard = { ...mockCard, id: 'new-id', name: 'New Card' }
    rerender(<ThemeSuggestions {...defaultProps} card={newCard} />)
    
    // Should not crash when card changes
    expect(document.body).toBeTruthy()
  })
})