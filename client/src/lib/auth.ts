// Simple client-side user tracking for deck functionality
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