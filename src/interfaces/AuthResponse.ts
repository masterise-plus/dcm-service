export interface AuthResponse {
  access_token: string;
  signature: string;
  scope: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  api_instance_url?: string;
}