export interface AuthService {
  getAccessToken(): Promise<string>;
  refreshToken(): Promise<string>;
  validateToken(token: string): Promise<boolean>;
  isTokenValid(): Promise<boolean>;
  getCachedToken(): string | null;
  getTokenExpiryTime(): number;
  getTimeUntilExpiry(): number;
  isTokenExpired(): boolean;
}
