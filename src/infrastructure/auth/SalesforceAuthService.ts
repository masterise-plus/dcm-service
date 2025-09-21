import { AuthService } from '@/interfaces/AuthService';
import { ConfigService } from '@/config/Config';
import { AuthResponse } from '@/interfaces/AuthResponse';
import { createServiceLogger } from '@/utils/Logger';

export class SalesforceAuthService implements AuthService {
  private config = ConfigService.getInstance().getConfig();
  private currentToken: string | null = null;
  private tokenExpiry: number = 0;
  private logger = createServiceLogger('SalesforceAuthService');
  private validationCache: Map<string, { isValid: boolean; timestamp: number }> = new Map();
  private readonly VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
    // First check if we have a cached token that's not expired
    if (this.currentToken && !this.isTokenExpired()) {
      // Validate the cached token before using it
      const isValid = await this.isTokenValid();
      if (isValid) {
        const timeUntilExpiry = this.getTimeUntilExpiry();
        this.logger.info('Using validated cached access token', { 
          tokenLength: this.currentToken.length,
          expiresInMs: timeUntilExpiry,
          expiresInMinutes: Math.round(timeUntilExpiry / 60000),
          expiryTime: new Date(this.tokenExpiry).toISOString()
        });
        return this.currentToken;
      } else {
        this.logger.warn('Cached token validation failed, will refresh');
        this.clearCachedToken();
      }
    }

    if (this.isTokenExpired()) {
      this.logger.warn('Access token has expired', {
        currentTime: new Date().toISOString(),
        expiryTime: new Date(this.tokenExpiry).toISOString(),
        timeSinceExpiry: Date.now() - this.tokenExpiry
      });
    } else {
      this.logger.info('Access token not available or invalid, refreshing token');
    }
    
    return this.refreshToken();
  }

  getCachedToken(): string | null {
    return this.currentToken;
  }

  getTokenExpiryTime(): number {
    return this.tokenExpiry;
  }

  getTimeUntilExpiry(): number {
    if (!this.currentToken || this.tokenExpiry === 0) {
      return 0;
    }
    return this.tokenExpiry - Date.now();
  }

  isTokenExpired(): boolean {
    if (!this.currentToken || this.tokenExpiry === 0) {
      return true;
    }
    return Date.now() >= this.tokenExpiry;
  }

  async isTokenValid(): Promise<boolean> {
    if (!this.currentToken) {
      return false;
    }

    // Check validation cache first
    const cacheKey = this.currentToken.substring(0, 50); // Use first 50 chars as cache key
    const cachedValidation = this.validationCache.get(cacheKey);
    
    if (cachedValidation && Date.now() - cachedValidation.timestamp < this.VALIDATION_CACHE_TTL) {
      this.logger.debug('Using cached validation result', { isValid: cachedValidation.isValid });
      return cachedValidation.isValid;
    }

    // Validate the token
    const isValid = await this.validateToken(this.currentToken);
    
    // Cache the validation result
    this.validationCache.set(cacheKey, {
      isValid,
      timestamp: Date.now()
    });

    return isValid;
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      this.logger.debug('Validating access token', { 
        tokenLength: token.length,
        instanceUrl: this.config.instanceUrl 
      });

      // Use Salesforce identity endpoint to validate token
      const identityUrl = `${this.config.instanceUrl}/services/oauth2/userinfo`;
      
      const response = await fetch(identityUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'SalesforceAuthService/1.0'
        }
      });

      if (response.ok) {
        this.logger.debug('Token validation successful');
        return true;
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        this.logger.warn('Token validation failed', { 
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 200) // Limit error text length
        });
        return false;
      }
    } catch (error) {
      this.logger.error('Token validation error', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private clearCachedToken(): void {
    this.currentToken = null;
    this.tokenExpiry = 0;
    this.validationCache.clear();
    this.logger.debug('Cleared cached token and validation cache');
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
