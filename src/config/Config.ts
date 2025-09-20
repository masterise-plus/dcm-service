export interface Config {
  instanceUrl: string;
  apiVersion: string;
  dataspace: string;
  accessToken: string;
  sqlQuery: string;
  outputCsvPath: string;
  clientId?: string;
  clientSecret?: string;
  useOAuth: boolean;
}

export class ConfigService {
  private static instance: ConfigService;
  private config: Config;

  private constructor() {
    const useOAuth = process.env.USE_OAUTH === 'true';
    
    this.config = {
      instanceUrl: this.mustGet('SF_INSTANCE_URL'),
      apiVersion: process.env.SF_API_VERSION || 'v64.0',
      dataspace: this.mustGet('SF_DATASPACE'),
      accessToken: this.mustGet('SF_ACCESS_TOKEN'),
      sqlQuery: this.mustGet('QUERY_SQL'),
      outputCsvPath: `./baseevent_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
      clientId: process.env.SF_CLIENT_ID,
      clientSecret: process.env.SF_CLIENT_SECRET,
      useOAuth: useOAuth
    };
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  public getConfig(): Config {
    return this.config;
  }

  private mustGet(name: string): string {
    const value = process.env[name];
    if (!value) {
      console.error(`[config] Missing required environment variable: ${name}`);
      process.exit(1);
    }
    return value;
  }
}
