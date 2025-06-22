// Simple client-side user identification using localStorage
export function getUserId(): string {
  let userId = localStorage.getItem('deck-builder-user-id');
  
  if (!userId) {
    // Generate a unique user ID
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('deck-builder-user-id', userId);
  }
  
  return userId;
}

// Function to clear user data (for testing or reset)
export function clearUserData(): void {
  localStorage.removeItem('deck-builder-user-id');
}

// Function to check if user has an ID stored
export function hasStoredUserId(): boolean {
  return !!localStorage.getItem('deck-builder-user-id');
}