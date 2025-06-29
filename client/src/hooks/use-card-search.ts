import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { SearchFilters, SearchResponse, Card } from "@shared/schema";
import { api } from "@/lib/api-client";

export function useCardSearch(filters: SearchFilters, enabled: boolean = true) {
  return useInfiniteQuery({
    queryKey: ['/api/cards/search', filters],
    initialPageParam: 1,
    enabled,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const searchParams = new URLSearchParams({
        page: pageParam.toString(),
      });

      // Send filters as JSON (preferred method that backend expects)
      const filtersToSend = { ...filters };
      if (Object.keys(filtersToSend).length > 0) {
        searchParams.set('filters', JSON.stringify(filtersToSend));
      }

      console.log('🔍 Frontend sending filters:', JSON.stringify(filtersToSend));

      return await api.get(`/api/cards/search?${searchParams}`) as SearchResponse;
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage?.has_more ? pages.length + 1 : undefined;
    },
    // No staleTime override - use global cache settings
    refetchOnWindowFocus: false,
  });
}

export function useCard(id: string) {
  return useQuery({
    queryKey: ['/api/cards', id],
    queryFn: async () => {
      try {
        return await api.get(`/api/cards/${id}`) as Card;
      } catch (error: any) {
        if (error.status === 404) return null;
        throw error;
      }
    },
    enabled: !!id,
    // No staleTime override - use global cache settings
  });
}

export function useRandomCard() {
  return useQuery({
    queryKey: ['/api/cards/random'],
    queryFn: async () => {
      return await api.get('/api/cards/random') as Card;
    },
    staleTime: 0, // Always fresh for random cards (override global setting)
  });
}
