// This file is deprecated - user identification moved to user-id.ts
// Keeping for backward compatibility

import { getUserId } from './user-id';

export class UserAuth {
  static getUserId(): string {
    return getUserId();
  }
  
  static getAuthHeaders(): HeadersInit {
    return {
      'X-User-ID': getUserId(),
      'Content-Type': 'application/json'
    };
  }
}