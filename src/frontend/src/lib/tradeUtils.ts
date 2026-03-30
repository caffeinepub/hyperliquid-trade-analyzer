import type { TradePosition, TradeSummary } from "../backend";
import {
  AssetCategoryEnum,
  PositionStatus,
  RiskLevel,
  TradeDirectionEnum,
} from "../backend";

// ── Metal helpers ────────────────────────────────────────────────────────────

const METAL_KEYWORDS = [
  "xau",
  "xag",
  "xcu",
  "gold",
  "silver",
  "silber",
  "copper",
];

export function isMetal(symbol: string): boolean {
  const s = symbol.toLowerCase();
  return METAL_KEYWORDS.some((k) => s.includes(k));
}

export function getMetalIcon(symbol: string): string {
  const s = symbol.toLowerCase();
  if (s.includes("gold") || s.includes("xau")) return "🥇";
  if (s.includes("silver") || s.includes("silber") || s.includes("xag"))
    return "🥈";
  if (s.includes("copper") || s.includes("kupfer") || s.includes("xcu"))
    return "🥉";
  return "🔩";
}

export function getMetalColor(symbol: string): string {
  const s = symbol.toLowerCase();
  if (s.includes("gold") || s.includes("xau")) return "#f59e0b";
  if (s.includes("silver") || s.includes("silber") || s.includes("xag"))
    return "#94a3b8";
  if (s.includes("copper") || s.includes("xcu")) return "#b45309";
  return "#a3a3a3";
}

export function getMetalPositions(positions: TradePosition[]): TradePosition[] {
  return positions.filter((p) => isMetal(p.symbol));
}

// ── Stablecoin helpers ───────────────────────────────────────────────────────

const STABLECOIN_KEYWORDS = [
  "usdc",
  "usdt",
  "usde",
  "usdh",
  "dai",
  "busd",
  "frax",
];

export function isStablecoin(symbol: string): boolean {
  const s = symbol.toLowerCase();
  return STABLECOIN_KEYWORDS.some((k) => s.includes(k));
}

export function getStablecoinIcon(symbol?: string): string {
  const s = (symbol ?? "").toLowerCase();
  if (s.includes("usdc")) return "💵";
  if (s.includes("usdt")) return "💴";
  if (s.includes("usde") || s.includes("usdh")) return "💶";
  return "💲";
}

export function getStablecoinColor(_symbol?: string): string {
  return "#22c55e";
}

export function getStablecoinPositions(
  positions: TradePosition[],
): TradePosition[] {
  return positions.filter((p) => isStablecoin(p.symbol));
}

// ── Asset list helpers ───────────────────────────────────────────────────────

export function getAvailableAssets(positions: TradePosition[]): string[] {
  return [...new Set(positions.map((p) => p.symbol))].sort();
}

export function getAvailableMetals(positions: TradePosition[]): string[] {
  return [
    ...new Set(positions.filter((p) => isMetal(p.symbol)).map((p) => p.symbol)),
  ].sort();
}

export function getAvailableStablecoins(positions: TradePosition[]): string[] {
  return [
    ...new Set(
      positions.filter((p) => isStablecoin(p.symbol)).map((p) => p.symbol),
    ),
  ].sort();
}

export function getNonMetalNonStablecoinAssets(
  positions: TradePosition[],
): string[] {
  return [
    ...new Set(
      positions
        .filter((p) => !isMetal(p.symbol) && !isStablecoin(p.symbol))
        .map((p) => p.symbol),
    ),
  ].sort();
}

// ── Long/Short helpers ───────────────────────────────────────────────────────

export function getLongPositions(positions: TradePosition[]): TradePosition[] {
  return positions.filter((p) => p.direction === TradeDirectionEnum.long_);
}

export function getShortPositions(positions: TradePosition[]): TradePosition[] {
  return positions.filter((p) => p.direction === TradeDirectionEnum.short_);
}

export function getLongColor(): string {
  return "#10b981";
}

export function getShortColor(): string {
  return "#ef4444";
}

// ── Filtering helpers ────────────────────────────────────────────────────────

export function getFilteredPositions(
  positions: TradePosition[],
  selectedAsset: string | null,
): TradePosition[] {
  if (!selectedAsset) return positions;
  return positions.filter((p) => p.symbol === selectedAsset);
}

// ── Format helpers ───────────────────────────────────────────────────────────

export function formatCurrency(value: number, decimals = 2): string {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000) {
    formatted = `${(value / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    formatted = `${(value / 1_000).toFixed(1)}k`;
  } else {
    formatted = value.toFixed(decimals);
  }
  return `${value < 0 ? "-" : ""}${Math.abs(value) < 0.001 ? value.toFixed(6) : formatted} USDC`;
}

export function getDirectionLabel(direction: TradeDirectionEnum): string {
  return direction === TradeDirectionEnum.long_ ? "Long" : "Short";
}

// ── Risk / Status label helpers ──────────────────────────────────────────────

export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case RiskLevel.extreme:
      return "text-red-500 font-bold";
    case RiskLevel.high:
      return "text-orange-500 font-semibold";
    case RiskLevel.medium:
      return "text-yellow-500";
    default:
      return "text-emerald-500";
  }
}

export function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case RiskLevel.extreme:
      return "Extrem";
    case RiskLevel.high:
      return "Hoch";
    case RiskLevel.medium:
      return "Mittel";
    default:
      return "Niedrig";
  }
}

export function getStatusColor(
  status: PositionStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case PositionStatus.liquidated:
      return "destructive";
    case PositionStatus.atRisk:
      return "outline";
    case PositionStatus.safe:
      return "default";
    default:
      return "secondary";
  }
}

export function getStatusLabel(status: PositionStatus): string {
  switch (status) {
    case PositionStatus.liquidated:
      return "Liquidiert";
    case PositionStatus.atRisk:
      return "Risiko";
    case PositionStatus.safe:
      return "Sicher";
    default:
      return "Ausstehend";
  }
}

// ── Summary / stats helpers ──────────────────────────────────────────────────

export function calculateFilteredSummary(
  positions: TradePosition[],
): TradeSummary {
  const totalPnl = positions.reduce((s, p) => s + p.realizedPnl, 0);
  const totalMargin = positions.reduce((s, p) => s + p.marginUsed, 0);
  const liquidated = positions.filter((p) => p.isLiquidated);

  // Determine worst risk level in filtered set
  const riskLevels = positions.map((p) => p.riskLevel);
  let averageRiskLevel = RiskLevel.low;
  if (riskLevels.includes(RiskLevel.extreme)) {
    averageRiskLevel = RiskLevel.extreme;
  } else if (riskLevels.includes(RiskLevel.high)) {
    averageRiskLevel = RiskLevel.high;
  } else if (riskLevels.includes(RiskLevel.medium)) {
    averageRiskLevel = RiskLevel.medium;
  }

  return {
    totalPositions: BigInt(positions.length),
    liquidatedPositions: BigInt(liquidated.length),
    totalPnl,
    totalMargin,
    totalMetalsPnl: positions
      .filter((p) => isMetal(p.symbol))
      .reduce((s, p) => s + p.realizedPnl, 0),
    averageRiskLevel,
  };
}

export function calculateAssetStats(
  positions: TradePosition[],
  asset: string,
): {
  symbol: string;
  totalPnl: number;
  averagePnl: number;
  tradeCount: number;
  longCount: number;
  shortCount: number;
  winRate: number;
  avgLeverage: number;
  totalFees: number;
  assetCategory: AssetCategoryEnum;
} {
  const filtered = positions.filter((p) => p.symbol === asset);
  const totalPnl = filtered.reduce((s, p) => s + p.realizedPnl, 0);
  const winners = filtered.filter((p) => p.realizedPnl > 0);
  const longs = getLongPositions(filtered);
  const shorts = getShortPositions(filtered);
  const leverages = filtered
    .filter((p) => p.leverage !== undefined)
    .map((p) => p.leverage as number);
  const avgLeverage = leverages.length
    ? leverages.reduce((a, b) => a + b, 0) / leverages.length
    : 0;
  const totalFees = filtered.reduce((s, p) => s + p.fee, 0);

  let assetCategory = AssetCategoryEnum.crypto;
  if (isMetal(asset)) assetCategory = AssetCategoryEnum.metal;
  else if (isStablecoin(asset)) assetCategory = AssetCategoryEnum.stablecoin;

  const averagePnl = filtered.length > 0 ? totalPnl / filtered.length : 0;

  return {
    symbol: asset,
    totalPnl,
    averagePnl,
    tradeCount: filtered.length,
    longCount: longs.length,
    shortCount: shorts.length,
    winRate: filtered.length > 0 ? (winners.length / filtered.length) * 100 : 0,
    avgLeverage,
    totalFees,
    assetCategory,
  };
}
