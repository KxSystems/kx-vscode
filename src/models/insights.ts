export interface InsightDetails {
  alias: string;
  server: string;
  auth: boolean;
}

export interface Insights {
  [name: string]: InsightDetails;
}
