// Simple client-side user tracking for deck functionality
// Cloudflare Integration Notes:
// - User IDs stored in localStorage work seamlessly with Cloudflare
// - Cloudflare caching won't affect user-specific requests due to headers
// - For custom domain: update any hardcoded URLs to use new domain
export class UserAuth {
  private static readonly USER_ID_KEY = 'mtg_user_id';
  
  static getUserId(): string {
    let userId = localStorage.getItem(this.USER_ID_KEY);
    
    if (!userId) {
      // Generate new user ID if none exists
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(this.USER_ID_KEY, userId);
    }
    
    return userId;
  }
  
  static setUserId(userId: string): void {
    localStorage.setItem(this.USER_ID_KEY, userId);
  }
  
  static clearUserId(): void {
    localStorage.removeItem(this.USER_ID_KEY);
  }
  
  // Add user ID to request headers
  static getAuthHeaders(): HeadersInit {
    return {
      'X-User-ID': this.getUserId(),
      'Content-Type': 'application/json'
    };
  }
}