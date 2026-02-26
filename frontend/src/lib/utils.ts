import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { RiskLevel, PositionStatus, TradeDirectionEnum, type TradePosition, type TradeSummary } from '../backend';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function getStatusColor(status: PositionStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case PositionStatus.safe:
      return 'default';
    case PositionStatus.atRisk:
      return 'secondary';
    case PositionStatus.liquidated:
      return 'destructive';
    case PositionStatus.pending:
      return 'outline';
    default:
      return 'outline';
  }
}

export function getStatusLabel(status: PositionStatus): string {
  switch (status) {
    case PositionStatus.safe:
      return 'Sicher';
    case PositionStatus.atRisk:
      return 'Risiko';
    case PositionStatus.liquidated:
      return 'Liquidiert';
    case PositionStatus.pending:
      return 'Ausstehend';
    default:
      return 'Unbekannt';
  }
}

export function getRiskLevelColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case RiskLevel.low:
      return 'text-success';
    case RiskLevel.medium:
      return 'text-warning';
    case RiskLevel.high:
      return 'text-destructive';
    case RiskLevel.extreme:
      return 'text-destructive font-bold';
    default:
      return 'text-muted-foreground';
  }
}

export function getRiskLevelLabel(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case RiskLevel.low:
      return 'Niedrig';
    case RiskLevel.medium:
      return 'Mittel';
    case RiskLevel.high:
      return 'Hoch';
    case RiskLevel.extreme:
      return 'Extrem';
    default:
      return 'Unbekannt';
  }
}

// Metal detection
const METALS = ['Silber', 'Gold', 'Kupfer'];

export function isMetal(symbol: string): boolean {
  return METALS.includes(symbol);
}

export function getMetals(): string[] {
  return [...METALS];
}

// Stablecoin detection
const STABLECOINS = ['USDC', 'USDE', 'USDH'];

export function isStablecoin(symbol: string): boolean {
  return STABLECOINS.some(stable => symbol.toUpperCase().includes(stable));
}

export function getStablecoins(): string[] {
  return [...STABLECOINS];
}

// Get all unique assets from positions
export function getAvailableAssets(positions: TradePosition[]): string[] {
  const assets = new Set<string>();
  positions.forEach(position => {
    if (position.symbol) {
      assets.add(position.symbol);
    }
  });
  return Array.from(assets).sort();
}

// Get metals from positions
export function getAvailableMetals(positions: TradePosition[]): string[] {
  const assets = getAvailableAssets(positions);
  return assets.filter(asset => isMetal(asset));
}

// Get stablecoins from positions
export function getAvailableStablecoins(positions: TradePosition[]): string[] {
  const assets = getAvailableAssets(positions);
  return assets.filter(asset => isStablecoin(asset));
}

// Get non-metal, non-stablecoin assets from positions
export function getNonMetalNonStablecoinAssets(positions: TradePosition[]): string[] {
  const assets = getAvailableAssets(positions);
  return assets.filter(asset => !isMetal(asset) && !isStablecoin(asset));
}

// Filter positions by asset
export function getFilteredPositions(positions: TradePosition[], selectedAsset: string | null): TradePosition[] {
  if (!selectedAsset) {
    return positions;
  }
  return positions.filter(position => position.symbol === selectedAsset);
}

// Get metal positions
export function getMetalPositions(positions: TradePosition[]): TradePosition[] {
  return positions.filter(position => isMetal(position.symbol));
}

// Get stablecoin positions
export function getStablecoinPositions(positions: TradePosition[]): TradePosition[] {
  return positions.filter(position => isStablecoin(position.symbol));
}

// Get Long positions
export function getLongPositions(positions: TradePosition[]): TradePosition[] {
  return positions.filter(position => position.direction === TradeDirectionEnum.long_);
}

// Get Short positions
export function getShortPositions(positions: TradePosition[]): TradePosition[] {
  return positions.filter(position => position.direction === TradeDirectionEnum.short_);
}

// Calculate asset-specific statistics
export interface AssetStats {
  symbol: string;
  totalPnl: number;
  averagePnl: number;
  tradeCount: number;
}

export function calculateAssetStats(positions: TradePosition[], asset: string): AssetStats {
  const assetPositions = positions.filter(p => p.symbol === asset);
  const totalPnl = assetPositions.reduce((sum, p) => sum + p.realizedPnl, 0);
  const tradeCount = assetPositions.length;
  const averagePnl = tradeCount > 0 ? totalPnl / tradeCount : 0;

  return {
    symbol: asset,
    totalPnl,
    averagePnl,
    tradeCount,
  };
}

// Calculate metals statistics
export function calculateMetalsStats(positions: TradePosition[]): AssetStats {
  const metalPositions = getMetalPositions(positions);
  const totalPnl = metalPositions.reduce((sum, p) => sum + p.realizedPnl + p.unrealizedPnl, 0);
  const tradeCount = metalPositions.length;
  const averagePnl = tradeCount > 0 ? totalPnl / tradeCount : 0;

  return {
    symbol: 'Metalle',
    totalPnl,
    averagePnl,
    tradeCount,
  };
}

// Calculate stablecoins statistics
export function calculateStablecoinsStats(positions: TradePosition[]): AssetStats {
  const stablecoinPositions = getStablecoinPositions(positions);
  const totalPnl = stablecoinPositions.reduce((sum, p) => sum + p.realizedPnl + p.unrealizedPnl, 0);
  const tradeCount = stablecoinPositions.length;
  const averagePnl = tradeCount > 0 ? totalPnl / tradeCount : 0;

  return {
    symbol: 'Stablecoins',
    totalPnl,
    averagePnl,
    tradeCount,
  };
}

// Calculate summary for filtered positions
export function calculateFilteredSummary(positions: TradePosition[]): TradeSummary {
  const totalPositions = BigInt(positions.length);
  const liquidatedPositions = BigInt(positions.filter(p => p.isLiquidated).length);
  const totalPnl = positions.reduce((sum, p) => sum + p.realizedPnl + p.unrealizedPnl, 0);
  const totalMargin = positions.reduce((sum, p) => sum + p.marginUsed, 0);
  
  const metalPositions = getMetalPositions(positions);
  const totalMetalsPnl = metalPositions.reduce((sum, p) => sum + p.realizedPnl + p.unrealizedPnl, 0);

  const riskLevelValues: Record<RiskLevel, number> = {
    [RiskLevel.low]: 1,
    [RiskLevel.medium]: 2,
    [RiskLevel.high]: 3,
    [RiskLevel.extreme]: 4,
  };

  const averageRiskValue = positions.length > 0
    ? positions.reduce((sum, p) => sum + riskLevelValues[p.riskLevel], 0) / positions.length
    : 1;

  let averageRiskLevel: RiskLevel;
  if (averageRiskValue <= 1.5) {
    averageRiskLevel = RiskLevel.low;
  } else if (averageRiskValue <= 2.5) {
    averageRiskLevel = RiskLevel.medium;
  } else if (averageRiskValue <= 3.5) {
    averageRiskLevel = RiskLevel.high;
  } else {
    averageRiskLevel = RiskLevel.extreme;
  }

  return {
    totalPositions,
    liquidatedPositions,
    totalPnl,
    totalMargin,
    averageRiskLevel,
    totalMetalsPnl,
  };
}

// Get metal color for charts
export function getMetalColor(symbol: string): string {
  switch (symbol) {
    case 'Gold':
      return 'oklch(0.75 0.15 85)';
    case 'Silber':
      return 'oklch(0.80 0.02 264)';
    case 'Kupfer':
      return 'oklch(0.60 0.18 40)';
    default:
      return 'oklch(0.65 0.22 264)';
  }
}

// Get stablecoin color for charts
export function getStablecoinColor(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol.includes('USDC')) {
    return 'oklch(0.60 0.20 220)'; // Blue
  } else if (upperSymbol.includes('USDE')) {
    return 'oklch(0.65 0.18 160)'; // Green
  } else if (upperSymbol.includes('USDH')) {
    return 'oklch(0.70 0.16 280)'; // Purple
  }
  return 'oklch(0.65 0.15 200)'; // Default blue-ish
}

// Get Long/Short colors
export function getLongColor(): string {
  return 'oklch(0.68 0.20 145)'; // Green
}

export function getShortColor(): string {
  return 'oklch(0.62 0.26 25)'; // Red
}

// Get metal icon path
export function getMetalIcon(symbol: string): string | null {
  switch (symbol) {
    case 'Gold':
      return '/assets/generated/gold-icon-transparent.dim_64x64.png';
    case 'Silber':
      return '/assets/generated/silver-icon-transparent.dim_64x64.png';
    case 'Kupfer':
      return '/assets/generated/copper-icon-transparent.dim_64x64.png';
    default:
      return null;
  }
}

// Get stablecoin icon
export function getStablecoinIcon(): string {
  return '/assets/generated/stablecoin-icon-transparent.dim_64x64.png';
}

// Get direction icon
export function getDirectionIcon(direction: TradeDirectionEnum): string {
  if (direction === TradeDirectionEnum.long_) {
    return '/assets/generated/long-position-icon-transparent.dim_32x32.png';
  }
  return '/assets/generated/short-position-icon-transparent.dim_32x32.png';
}

// Get direction label
export function getDirectionLabel(direction: TradeDirectionEnum): string {
  return direction === TradeDirectionEnum.long_ ? 'Long' : 'Short';
}
