// Simple client-side user identification using localStorage
export function getUserId(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return '';
  }
  
  let userId = localStorage.getItem('deck-builder-user-id');
  
  if (!userId) {
    // Generate a unique user ID with timestamp and random component
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('deck-builder-user-id', userId);
    console.log(`📱 Generated new localStorage user ID: ${userId}`);
  } else {
    console.log(`📱 Retrieved existing user ID: ${userId}`);
  }
  
  return userId;
}

// Function to clear user data (for testing or reset)
export function clearUserData(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('deck-builder-user-id');
    console.log('🗑️ Cleared user data from localStorage');
  }
}

// Function to check if user has an ID stored
export function hasStoredUserId(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return !!localStorage.getItem('deck-builder-user-id');
}

// Function to set a specific user ID (for migration or testing)
export function setUserId(userId: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('deck-builder-user-id', userId);
    console.log(`📱 Set user ID: ${userId}`);
  }
}