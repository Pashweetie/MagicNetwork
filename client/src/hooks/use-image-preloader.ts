import { useCallback, useEffect } from 'react';
import { useImagePreloader } from '@/hooks/use-cached-image';
import { Card } from '@shared/schema';
import { CardUtils } from '@shared/utils/card-utils';

/**
 * Hook to preload card images in the background
 * Improves user experience by caching images before they're needed
 */
export function useCardImagePreloader() {
  const { preloadImages } = useImagePreloader();

  const preloadCardImages = useCallback(async (cards: Card[], priority: 'high' | 'low' = 'low') => {
    const imageUrls = cards
      .map(card => CardUtils.getCardImage(card))
      .filter(Boolean) as string[];

    if (imageUrls.length === 0) return;

    // For high priority, preload immediately
    if (priority === 'high') {
      await preloadImages(imageUrls);
      return;
    }

    // For low priority, preload with a delay to avoid blocking UI
    setTimeout(async () => {
      try {
        await preloadImages(imageUrls);
        console.log(`Preloaded ${imageUrls.length} card images`);
      } catch (error) {
        console.warn('Failed to preload some images:', error);
      }
    }, 1000);
  }, [preloadImages]);

  const preloadSearchResults = useCallback((cards: Card[]) => {
    // Preload first 20 images with high priority, rest with low priority
    const highPriorityCards = cards.slice(0, 20);
    const lowPriorityCards = cards.slice(20);

    preloadCardImages(highPriorityCards, 'high');
    if (lowPriorityCards.length > 0) {
      preloadCardImages(lowPriorityCards, 'low');
    }
  }, [preloadCardImages]);

  const preloadDeckImages = useCallback((cards: Card[]) => {
    // Deck images should be preloaded with high priority
    preloadCardImages(cards, 'high');
  }, [preloadCardImages]);

  return {
    preloadCardImages,
    preloadSearchResults,
    preloadDeckImages
  };
}

/**
 * Hook to automatically preload images when cards become visible
 * Uses Intersection Observer for efficient preloading
 */
export function useVisibilityPreloader() {
  const { preloadImages } = useImagePreloader();

  const createVisibilityObserver = useCallback((
    cardElements: HTMLElement[],
    cards: Card[]
  ) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-card-index') || '0');
            const card = cards[index];
            
            if (card) {
              const imageUrl = CardUtils.getCardImage(card);
              if (imageUrl) {
                preloadImages([imageUrl]).catch(console.warn);
              }
            }
            
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '100px' // Start preloading 100px before image is visible
      }
    );

    cardElements.forEach((element, index) => {
      element.setAttribute('data-card-index', index.toString());
      observer.observe(element);
    });

    return observer;
  }, [preloadImages]);

  return { createVisibilityObserver };
}