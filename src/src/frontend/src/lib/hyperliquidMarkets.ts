export const HYPERLIQUID_MARKETS = [
  "BTC",
  "ETH",
  "SOL",
  "HYPE",
  "XRP",
  "DOGE",
  "SUI",
  "AVAX",
  "LINK",
  "UNI",
  "AAVE",
  "ARB",
  "OP",
  "MATIC",
  "APT",
  "LTC",
  "BCH",
  "XLM",
  "ATOM",
  "FIL",
  "NEAR",
  "DOT",
  "TRX",
  "ADA",
  "SHIB",
  "TON",
  "ICP",
  "INJ",
  "SEI",
  "WIF",
] as const;

export type HyperliquidMarket = (typeof HYPERLIQUID_MARKETS)[number];

export function isValidMarket(symbol: string): symbol is HyperliquidMarket {
  return HYPERLIQUID_MARKETS.includes(symbol as HyperliquidMarket);
}

export function sanitizeSymbol(symbol: string): string {
  return symbol.toUpperCase().trim();
}

export function getDefaultMarket(): HyperliquidMarket {
  return "BTC";
}
