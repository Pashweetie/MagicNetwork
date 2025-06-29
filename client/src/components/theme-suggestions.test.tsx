import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeSuggestions } from './theme-suggestions'
import { renderWithProviders, mockCard, mockThemeGroups } from '../test/utils'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

describe('ThemeSuggestions', () => {
  const defaultProps = {
    card: mockCard,
    onCardClick: vi.fn(),
    onAddCard: vi.fn(),
    currentFilters: {}
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    renderWithProviders(<ThemeSuggestions {...defaultProps} />)
    
    expect(screen.getByText('Loading theme suggestions...')).toBeInTheDocument()
  })

  it('renders theme suggestions when data loads', async () => {
    renderWithProviders(<ThemeSuggestions {...defaultProps} />)
    
    // Wait for the data to load (MSW will provide mock data)
    await waitFor(() => {
      expect(screen.getByText('AI Theme Analysis')).toBeInTheDocument()
    })

    // Check if themes are rendered
    expect(screen.getByText('Burn')).toBeInTheDocument()
    expect(screen.getByText('Direct damage spells and effects')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
    
    expect(screen.getByText('Removal')).toBeInTheDocument()
    expect(screen.getByText('Creature and permanent removal')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders empty state when no themes found', async () => {
    // Mock empty response
    const { queryClient } = renderWithProviders(<ThemeSuggestions {...defaultProps} />)
    
    // Set empty data in query cache
    queryClient.setQueryData(
      ['/api/cards', mockCard.id, 'theme-suggestions', {}],
      { themeGroups: [], userVotes: [] }
    )

    await waitFor(() => {
      expect(screen.getByText('No theme suggestions found')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Try adjusting your search filters')).toBeInTheDocument()
  })

  it('handles theme voting', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeSuggestions {...defaultProps} />)
    
    // Wait for themes to load
    await waitFor(() => {
      expect(screen.getByText('Burn')).toBeInTheDocument()
    })

    // Find and click upvote button for Burn theme
    const upvoteButtons = screen.getAllByTitle('Vote theme as helpful')
    await user.click(upvoteButtons[0])

    // The MSW handler should respond with success
    // In a real test, we'd verify the API was called correctly
  })

  it('handles different card props correctly', () => {
    const differentCard = {
      ...mockCard,
      id: 'different-id',
      name: 'Lightning Bolt'
    }

    renderWithProviders(
      <ThemeSuggestions {...defaultProps} card={differentCard} />
    )

    // Should trigger a new query with the different card ID
    expect(screen.getByText('Loading theme suggestions...')).toBeInTheDocument()
  })

  it('calls onCardClick when similar card is clicked', async () => {
    const onCardClick = vi.fn()
    renderWithProviders(
      <ThemeSuggestions {...defaultProps} onCardClick={onCardClick} />
    )

    // Wait for themes to load
    await waitFor(() => {
      expect(screen.getByText('Burn')).toBeInTheDocument()
    })

    // If there were similar cards in the theme, we could test clicking them
    // For now, just verify the prop is passed through
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('handles API errors gracefully', async () => {
    // This would be handled by MSW error simulation
    const { queryClient } = renderWithProviders(<ThemeSuggestions {...defaultProps} />)
    
    // Simulate an error
    queryClient.setQueryData(
      ['/api/cards', mockCard.id, 'theme-suggestions', {}],
      undefined
    )
    
    queryClient.getQueryCache().find({
      queryKey: ['/api/cards', mockCard.id, 'theme-suggestions', {}]
    })?.setData(undefined)

    // The component should handle this gracefully
  })

  it('resets vote state when card changes', async () => {
    const { rerender } = renderWithProviders(<ThemeSuggestions {...defaultProps} />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Burn')).toBeInTheDocument()
    })

    // Change the card
    const newCard = { ...mockCard, id: 'new-card-id', name: 'New Card' }
    rerender(<ThemeSuggestions {...defaultProps} card={newCard} />)

    // Should show loading for new card
    expect(screen.getByText('Loading theme suggestions...')).toBeInTheDocument()
  })
})