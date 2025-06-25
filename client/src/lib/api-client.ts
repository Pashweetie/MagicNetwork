// Unified API client to eliminate duplicate fetch patterns
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success?: boolean;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Unified API client that handles common patterns:
 * - JSON serialization/deserialization
 * - Error handling with proper status codes
 * - Request/response logging
 * - Consistent error messages
 */
export class ApiClient {
  private static baseUrl = '';

  /**
   * Make an API request with unified error handling
   */
  static async request<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      signal
    } = options;

    // Prepare request
    const url = `${this.baseUrl}${endpoint}`;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal,
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);
      
      // Handle different response types
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If response isn't JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        
        throw new ApiError(errorMessage, response.status, response);
      }

      // Handle empty responses (e.g., 204 No Content)
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return null as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors, timeouts, etc.
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0
      );
    }
  }

  /**
   * GET request helper
   */
  static get<T = any>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', signal });
  }

  /**
   * POST request helper
   */
  static post<T = any>(
    endpoint: string,
    body?: any,
    signal?: AbortSignal
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body, signal });
  }

  /**
   * PUT request helper
   */
  static put<T = any>(
    endpoint: string,
    body?: any,
    signal?: AbortSignal
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body, signal });
  }

  /**
   * DELETE request helper
   */
  static delete<T = any>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', signal });
  }
}

/**
 * Convenience export for shorter usage
 */
export const api = ApiClient;