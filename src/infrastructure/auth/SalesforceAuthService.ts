import { AuthService } from '@/interfaces/AuthService';
import { ConfigService } from '@/config/Config';
import { AuthResponse } from '@/interfaces/AuthResponse';
import { createServiceLogger } from '@/utils/Logger';

export class SalesforceAuthService implements AuthService {
  private config = ConfigService.getInstance().getConfig();
  private currentToken: string | null = null;
  private tokenExpiry: number = 0;
  private logger = createServiceLogger('SalesforceAuthService');

  constructor(
    private clientId: string,
    private clientSecret: string,
    private grantType: string = 'client_credentials'
  ) {
    this.logger.info('SalesforceAuthService initialized', { 
      clientId: this.clientId,
      grantType: this.grantType,
      hasClientSecret: !!this.clientSecret 
    });
  }

  async getAccessToken(): Promise<string> {
    if (this.currentToken && Date.now() < this.tokenExpiry) {
      this.logger.debug('Using cached access token', { 
        tokenLength: this.currentToken.length,
        expiresIn: this.tokenExpiry - Date.now() 
      });
      return this.currentToken;
    }

    this.logger.info('Access token expired or not available, refreshing token');
    return this.refreshToken();
  }

  async refreshToken(): Promise<string> {
    const url = `${this.config.instanceUrl}/services/oauth2/token`;
    
    this.logger.info('🔐 Refreshing OAuth token', { 
      instanceUrl: this.config.instanceUrl,
      grantType: this.grantType,
      clientId: this.clientId 
    });

    const formData = new URLSearchParams();
    formData.append('grant_type', this.grantType);
    formData.append('client_id', this.clientId);
    formData.append('client_secret', this.clientSecret);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://cumulustore.blendmedia.co.id',
        'Priority': 'u=1, i',
        'Referer': 'https://cumulustore.blendmedia.co.id/',
        'Sec-Ch-Ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'Cookie': 'BrowserId=kaFCqol8EfCouCluakBkZg; CookieConsentPolicy=0:1; LSKey-c$CookieConsentPolicy=0:1'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error('❌ OAuth token request failed', { 
        status: response.status,
        statusText: response.statusText,
        errorText: text,
        url: url 
      });
      throw new Error(`OAuth token request failed ${response.status}: ${text}`);
    }

    const authData = await response.json() as AuthResponse;
    
    // Store the token and set expiry (typically 2 hours for Salesforce)
    this.currentToken = authData.access_token;
    this.tokenExpiry = Date.now() + (2 * 60 * 60 * 1000); // 2 hours from now
    
    this.logger.info('✅ Successfully obtained access token', {
      tokenType: authData.token_type,
      scope: authData.scope,
      instanceUrl: authData.instance_url,
      issuedAt: authData.issued_at,
      tokenLength: authData.access_token.length,
      expiresAt: new Date(this.tokenExpiry).toISOString()
    });
    
    return this.currentToken;
  }
}
