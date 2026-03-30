import type { TradePosition } from "../backend";
import { TradeDirectionEnum } from "../backend";

/**
 * Fee Alpha Label: Categorical classification of fee efficiency
 */
export type FeeAlphaLabel = "Captured" | "Paid" | "Neutral";

/**
 * Fee Alpha Score: Numeric score representing fee efficiency
 * Negative fees (rebates) = positive score
 * Positive fees (paid) = negative score
 * Normalized by notional value for comparability
 */
export interface FeeAlphaData {
  label: FeeAlphaLabel;
  score: number;
  fee: number;
  notional: number;
}

/**
 * Compute Fee Alpha label from position fee
 */
export function getFeeAlphaLabel(fee: number): FeeAlphaLabel {
  if (fee < 0) return "Captured";
  if (fee > 0) return "Paid";
  return "Neutral";
}

/**
 * Compute Fee Alpha Score for a position
 * Score = -fee / notional * 10000 (basis points)
 * Positive score = captured fees (good)
 * Negative score = paid fees (bad)
 */
export function computeFeeAlpha(position: TradePosition): FeeAlphaData {
  const notional = Math.abs(position.entryPrice * position.positionSize);
  const score = notional > 0 ? (-position.fee / notional) * 10000 : 0;

  return {
    label: getFeeAlphaLabel(position.fee),
    score,
    fee: position.fee,
    notional,
  };
}

/**
 * Format Fee Alpha Score for display
 */
export function formatFeeAlphaScore(score: number): string {
  return score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

/**
 * Get color class for Fee Alpha label
 */
export function getFeeAlphaColor(label: FeeAlphaLabel): string {
  switch (label) {
    case "Captured":
      return "text-success";
    case "Paid":
      return "text-destructive";
    case "Neutral":
      return "text-muted-foreground";
  }
}

/**
 * Aggregation: Net Fee Alpha (sum of all captured minus paid)
 */
export function calculateNetFeeAlpha(positions: TradePosition[]): number {
  return positions.reduce((sum, p) => {
    const alpha = computeFeeAlpha(p);
    return sum + alpha.score;
  }, 0);
}

/**
 * Aggregation: Count positions by Fee Alpha label
 */
export function countByFeeAlphaLabel(
  positions: TradePosition[],
): Record<FeeAlphaLabel, number> {
  const counts: Record<FeeAlphaLabel, number> = {
    Captured: 0,
    Paid: 0,
    Neutral: 0,
  };

  for (const p of positions) {
    const label = getFeeAlphaLabel(p.fee);
    counts[label]++;
  }

  return counts;
}

/**
 * Aggregation: Group positions by asset and compute Fee Alpha stats
 */
export function groupByAssetFeeAlpha(positions: TradePosition[]): Array<{
  asset: string;
  netFeeAlpha: number;
  totalFees: number;
  tradeCount: number;
  capturedCount: number;
  paidCount: number;
}> {
  const assetMap = new Map<string, TradePosition[]>();

  for (const p of positions) {
    if (!assetMap.has(p.symbol)) {
      assetMap.set(p.symbol, []);
    }
    assetMap.get(p.symbol)!.push(p);
  }

  return Array.from(assetMap.entries())
    .map(([asset, trades]) => {
      const netFeeAlpha = calculateNetFeeAlpha(trades);
      const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);
      const counts = countByFeeAlphaLabel(trades);

      return {
        asset,
        netFeeAlpha,
        totalFees,
        tradeCount: trades.length,
        capturedCount: counts.Captured,
        paidCount: counts.Paid,
      };
    })
    .sort((a, b) => b.netFeeAlpha - a.netFeeAlpha);
}

/**
 * Aggregation: Group positions by direction and compute Fee Alpha stats
 */
export function groupByDirectionFeeAlpha(positions: TradePosition[]): Array<{
  direction: TradeDirectionEnum;
  directionLabel: string;
  netFeeAlpha: number;
  totalFees: number;
  tradeCount: number;
  capturedCount: number;
  paidCount: number;
}> {
  const longPositions = positions.filter(
    (p) => p.direction === TradeDirectionEnum.long_,
  );
  const shortPositions = positions.filter(
    (p) => p.direction === TradeDirectionEnum.short_,
  );

  const result: Array<{
    direction: TradeDirectionEnum;
    directionLabel: string;
    netFeeAlpha: number;
    totalFees: number;
    tradeCount: number;
    capturedCount: number;
    paidCount: number;
  }> = [];

  if (longPositions.length > 0) {
    const counts = countByFeeAlphaLabel(longPositions);
    result.push({
      direction: TradeDirectionEnum.long_,
      directionLabel: "Long",
      netFeeAlpha: calculateNetFeeAlpha(longPositions),
      totalFees: longPositions.reduce((sum, p) => sum + p.fee, 0),
      tradeCount: longPositions.length,
      capturedCount: counts.Captured,
      paidCount: counts.Paid,
    });
  }

  if (shortPositions.length > 0) {
    const counts = countByFeeAlphaLabel(shortPositions);
    result.push({
      direction: TradeDirectionEnum.short_,
      directionLabel: "Short",
      netFeeAlpha: calculateNetFeeAlpha(shortPositions),
      totalFees: shortPositions.reduce((sum, p) => sum + p.fee, 0),
      tradeCount: shortPositions.length,
      capturedCount: counts.Captured,
      paidCount: counts.Paid,
    });
  }

  return result;
}

/**
 * Get top Fee Alpha winners (most captured) and losers (most paid)
 */
export function getTopFeeAlphaTrades(
  positions: TradePosition[],
  limit = 10,
): {
  winners: Array<{ position: TradePosition; alpha: FeeAlphaData }>;
  losers: Array<{ position: TradePosition; alpha: FeeAlphaData }>;
} {
  const tradesWithAlpha = positions.map((p) => ({
    position: p,
    alpha: computeFeeAlpha(p),
  }));

  const sorted = [...tradesWithAlpha].sort(
    (a, b) => b.alpha.score - a.alpha.score,
  );

  return {
    winners: sorted.slice(0, limit),
    losers: sorted.slice(-limit).reverse(),
  };
}

/**
 * Comparator for sorting positions by Fee Alpha Score (stable)
 */
export function compareFeeAlpha(a: TradePosition, b: TradePosition): number {
  const alphaA = computeFeeAlpha(a);
  const alphaB = computeFeeAlpha(b);

  // Primary: by score (descending)
  if (alphaB.score !== alphaA.score) {
    return alphaB.score - alphaA.score;
  }

  // Tie-breaker: by tradeId
  return a.tradeId.localeCompare(b.tradeId);
}
