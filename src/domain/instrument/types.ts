export interface InstrumentRecord {
  kind?: "EQUITY" | "INDEX";
  isWatchlistEligible?: boolean;
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  sector: string | null;
  currency: string;
  isActive: boolean;
}
