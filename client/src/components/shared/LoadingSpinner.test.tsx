import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from './LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(<LoadingSpinner />)
    
    // Check if the spinner container is rendered by class
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders with custom message', () => {
    const message = 'Loading custom content...'
    render(<LoadingSpinner message={message} />)
    
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-class" />)
    
    const container = document.querySelector('.custom-class')
    expect(container).toBeInTheDocument()
  })

  it('renders different sizes', () => {
    const { rerender } = render(<LoadingSpinner size="sm" />)
    let spinner = document.querySelector('.animate-spin')
    expect(spinner).toHaveClass('w-4', 'h-4')

    rerender(<LoadingSpinner size="lg" />)
    spinner = document.querySelector('.animate-spin')
    expect(spinner).toHaveClass('w-8', 'h-8')
  })

  it('renders different colors', () => {
    render(<LoadingSpinner color="purple" />)
    
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toHaveClass('border-purple-400')
  })
})