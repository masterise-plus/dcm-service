export interface AuthService {
  getAccessToken(): Promise<string>;
  refreshToken(): Promise<string>;
}