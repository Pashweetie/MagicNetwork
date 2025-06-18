import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { SearchFilters, SearchResponse, Card } from "@shared/schema";

export function useCardSearch(filters: SearchFilters) {
  return useInfiniteQuery<SearchResponse, Error, SearchResponse[], string[], number>({
    queryKey: ['/api/cards/search', filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const searchParams = new URLSearchParams({
        page: pageParam.toString(),
      });

      if (filters.query) searchParams.set('q', filters.query);
      if (filters.colors?.length) searchParams.set('colors', filters.colors.join(','));
      if (filters.types?.length) searchParams.set('types', filters.types.join(','));
      if (filters.rarities?.length) searchParams.set('rarities', filters.rarities.join(','));
      if (filters.format) searchParams.set('format', filters.format);
      if (filters.minMv !== undefined) searchParams.set('minMv', filters.minMv.toString());
      if (filters.maxMv !== undefined) searchParams.set('maxMv', filters.maxMv.toString());
      if (filters.includeMulticolored) searchParams.set('includeMulticolored', 'true');
      if (filters.oracleText) searchParams.set('oracleText', filters.oracleText);
      if (filters.set) searchParams.set('set', filters.set);
      if (filters.artist) searchParams.set('artist', filters.artist);
      if (filters.power) searchParams.set('power', filters.power);
      if (filters.toughness) searchParams.set('toughness', filters.toughness);
      if (filters.loyalty) searchParams.set('loyalty', filters.loyalty);
      if (filters.minPrice !== undefined) searchParams.set('minPrice', filters.minPrice.toString());
      if (filters.maxPrice !== undefined) searchParams.set('maxPrice', filters.maxPrice.toString());
      if (filters.colorIdentity?.length) searchParams.set('colorIdentity', filters.colorIdentity.join(','));
      if (filters.keywords?.length) searchParams.set('keywords', filters.keywords.join(','));
      if (filters.produces?.length) searchParams.set('produces', filters.produces.join(','));

      const response = await fetch(`/api/cards/search?${searchParams}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as SearchResponse;
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.has_more ? pages.length + 1 : undefined;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useCard(id: string) {
  return useQuery({
    queryKey: ['/api/cards', id],
    queryFn: async () => {
      const response = await fetch(`/api/cards/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch card: ${response.status} ${response.statusText}`);
      }

      return await response.json() as Card;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useRandomCard() {
  return useQuery({
    queryKey: ['/api/cards/random'],
    queryFn: async () => {
      const response = await fetch('/api/cards/random', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch random card: ${response.status} ${response.statusText}`);
      }

      return await response.json() as Card;
    },
    staleTime: 0, // Always fresh for random cards
  });
}
