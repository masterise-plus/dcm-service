export interface QueryRequest {
  sql: string;
  dataspace: string;
  rowLimit?: number;
}