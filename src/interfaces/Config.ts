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