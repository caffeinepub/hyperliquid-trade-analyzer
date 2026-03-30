import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Lightbulb,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { TradePosition } from "../backend";
import { TradeDirectionEnum } from "../backend";
import {
  type FeeAlphaLabel,
  calculateNetFeeAlpha,
  countByFeeAlphaLabel,
  formatFeeAlphaScore,
  getFeeAlphaColor,
  getTopFeeAlphaTrades,
  groupByAssetFeeAlpha,
  groupByDirectionFeeAlpha,
} from "../lib/feeAlpha";
import {
  formatCurrency,
  getDirectionLabel,
  isMetal,
  isStablecoin,
} from "../lib/tradeUtils";

interface FeeOverviewProps {
  positions: TradePosition[];
}

interface FeeAnalysis {
  totalFees: number;
  averageFee: number;
  feesByAsset: {
    asset: string;
    totalFees: number;
    tradeCount: number;
    percentageOfTotal: number;
  }[];
  feesByDirection: {
    direction: string;
    totalFees: number;
    tradeCount: number;
    percentageOfTotal: number;
  }[];
  feesByCategory: {
    categoryName: string;
    totalFees: number;
    tradeCount: number;
    percentageOfTotal: number;
  }[];
  topTradesByFee: {
    tradeId: string;
    asset: string;
    feeAmount: number;
    leverage: number | null;
    pnl: number;
  }[];
  recommendations: string[];
}

interface HighFeeTrade {
  tradeId: string;
  asset: string;
  feeAmount: number;
  notional: number;
  feeToNotionalRatio: number;
  leverage: number | null;
  pnl: number;
  direction: string;
  reason: string;
  recommendation: string;
}

interface FeeEfficiencyData {
  asset: string;
  tradeId: string;
  efficiencyScore: number;
  feeAmount: number;
  notional: number;
  category: "efficient" | "inefficient";
}

interface OptimizationAnalysis {
  highFeeTrades: HighFeeTrade[];
  averageFeeRates: Map<string, number>;
  efficiencyData: FeeEfficiencyData[];
  categoryRecommendations: Map<string, string[]>;
}

function analyzeFees(positions: TradePosition[]): FeeAnalysis {
  const totalFees = positions.reduce((sum, p) => sum + p.fee, 0);
  const averageFee = positions.length > 0 ? totalFees / positions.length : 0;

  // Fees by asset
  const assetFeeMap = new Map<
    string,
    { totalFees: number; tradeCount: number }
  >();
  for (const p of positions) {
    const existing = assetFeeMap.get(p.symbol) || {
      totalFees: 0,
      tradeCount: 0,
    };
    assetFeeMap.set(p.symbol, {
      totalFees: existing.totalFees + p.fee,
      tradeCount: existing.tradeCount + 1,
    });
  }

  const feesByAsset = Array.from(assetFeeMap.entries())
    .map(([asset, data]) => ({
      asset,
      totalFees: data.totalFees,
      tradeCount: data.tradeCount,
      percentageOfTotal: totalFees > 0 ? (data.totalFees / totalFees) * 100 : 0,
    }))
    .sort((a, b) => b.totalFees - a.totalFees);

  // Fees by direction using enum comparison
  const longFees = positions
    .filter((p) => p.direction === TradeDirectionEnum.long_)
    .reduce((sum, p) => sum + p.fee, 0);
  const shortFees = positions
    .filter((p) => p.direction === TradeDirectionEnum.short_)
    .reduce((sum, p) => sum + p.fee, 0);
  const longCount = positions.filter(
    (p) => p.direction === TradeDirectionEnum.long_,
  ).length;
  const shortCount = positions.filter(
    (p) => p.direction === TradeDirectionEnum.short_,
  ).length;

  const feesByDirection = [
    {
      direction: "Long",
      totalFees: longFees,
      tradeCount: longCount,
      percentageOfTotal: totalFees > 0 ? (longFees / totalFees) * 100 : 0,
    },
    {
      direction: "Short",
      totalFees: shortFees,
      tradeCount: shortCount,
      percentageOfTotal: totalFees > 0 ? (shortFees / totalFees) * 100 : 0,
    },
  ];

  // Fees by category
  const cryptoPositions = positions.filter(
    (p) => !isMetal(p.symbol) && !isStablecoin(p.symbol),
  );
  const metalPositions = positions.filter((p) => isMetal(p.symbol));
  const stablecoinPositions = positions.filter((p) => isStablecoin(p.symbol));

  const cryptoFees = cryptoPositions.reduce((sum, p) => sum + p.fee, 0);
  const metalFees = metalPositions.reduce((sum, p) => sum + p.fee, 0);
  const stablecoinFees = stablecoinPositions.reduce((sum, p) => sum + p.fee, 0);

  const feesByCategory = [
    {
      categoryName: "Kryptowährungen",
      totalFees: cryptoFees,
      tradeCount: cryptoPositions.length,
      percentageOfTotal: totalFees > 0 ? (cryptoFees / totalFees) * 100 : 0,
    },
    {
      categoryName: "Metalle",
      totalFees: metalFees,
      tradeCount: metalPositions.length,
      percentageOfTotal: totalFees > 0 ? (metalFees / totalFees) * 100 : 0,
    },
    {
      categoryName: "Stablecoins",
      totalFees: stablecoinFees,
      tradeCount: stablecoinPositions.length,
      percentageOfTotal: totalFees > 0 ? (stablecoinFees / totalFees) * 100 : 0,
    },
  ].filter((cat) => cat.tradeCount > 0);

  // Top 5 trades by fee
  const topTradesByFee = [...positions]
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5)
    .map((p) => ({
      tradeId: p.tradeId,
      asset: p.symbol,
      feeAmount: p.fee,
      leverage: p.leverage || null,
      pnl: p.realizedPnl,
    }));

  // Generate recommendations
  const recommendations: string[] = [];

  // High fee trades
  const highFeeTrades = positions.filter((p) => p.fee > averageFee * 2);
  if (highFeeTrades.length > 0) {
    recommendations.push(
      `${highFeeTrades.length} Trade${highFeeTrades.length !== 1 ? "s" : ""} mit überdurchschnittlich hohen Gebühren identifiziert. Erwägen Sie Limit-Orders statt Market-Orders.`,
    );
  }

  // Direction imbalance using enum comparison
  if (longCount > 0 && shortCount > 0) {
    const avgLongFee = longFees / longCount;
    const avgShortFee = shortFees / shortCount;
    if (Math.abs(avgLongFee - avgShortFee) > averageFee * 0.3) {
      const higherDirection = avgLongFee > avgShortFee ? "Long" : "Short";
      const lowerDirection = avgLongFee > avgShortFee ? "Short" : "Long";
      recommendations.push(
        `${higherDirection}-Positionen haben durchschnittlich höhere Gebühren als ${lowerDirection}-Positionen. Prüfen Sie alternative Einstiegspunkte.`,
      );
    }
  }

  // High leverage correlation
  const highLeverageTrades = positions.filter(
    (p) => p.leverage && p.leverage > 20,
  );
  if (highLeverageTrades.length > 0) {
    const avgHighLevFee =
      highLeverageTrades.reduce((sum, p) => sum + p.fee, 0) /
      highLeverageTrades.length;
    if (avgHighLevFee > averageFee * 1.5) {
      recommendations.push(
        "Trades mit hohem Hebel (>20x) verursachen überdurchschnittliche Gebühren. Reduzieren Sie den Hebel für kosteneffizienteres Trading.",
      );
    }
  }

  // Asset-specific recommendations
  if (feesByAsset.length > 0 && feesByAsset[0].percentageOfTotal > 40) {
    recommendations.push(
      `${feesByAsset[0].asset} macht ${feesByAsset[0].percentageOfTotal.toFixed(1)}% der Gesamtgebühren aus. Diversifizieren Sie Ihre Trades zur Gebührenoptimierung.`,
    );
  }

  // General recommendation
  if (recommendations.length === 0) {
    recommendations.push(
      "Ihre Gebührenstruktur ist ausgewogen. Nutzen Sie weiterhin Limit-Orders und vermeiden Sie unnötige Market-Orders.",
    );
  }

  return {
    totalFees,
    averageFee,
    feesByAsset,
    feesByDirection,
    feesByCategory,
    topTradesByFee,
    recommendations,
  };
}

function analyzeOptimization(positions: TradePosition[]): OptimizationAnalysis {
  // Calculate average fee rates per asset
  const averageFeeRates = new Map<string, number>();
  const assetGroups = new Map<string, TradePosition[]>();

  for (const p of positions) {
    if (!assetGroups.has(p.symbol)) {
      assetGroups.set(p.symbol, []);
    }
    assetGroups.get(p.symbol)!.push(p);
  }

  assetGroups.forEach((trades, asset) => {
    const totalNotional = trades.reduce(
      (sum, t) => sum + Math.abs(t.entryPrice * t.positionSize),
      0,
    );
    const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);
    const avgRate = totalNotional > 0 ? (totalFees / totalNotional) * 100 : 0;
    averageFeeRates.set(asset, avgRate);
  });

  // Calculate global average fee rate
  const globalTotalNotional = positions.reduce(
    (sum, p) => sum + Math.abs(p.entryPrice * p.positionSize),
    0,
  );
  const globalTotalFees = positions.reduce((sum, p) => sum + p.fee, 0);
  const globalAvgRate =
    globalTotalNotional > 0 ? (globalTotalFees / globalTotalNotional) * 100 : 0;

  // Identify high fee trades
  const highFeeTrades: HighFeeTrade[] = [];

  for (const p of positions) {
    const notional = Math.abs(p.entryPrice * p.positionSize);
    const feeToNotionalRatio = notional > 0 ? (p.fee / notional) * 100 : 0;
    const assetAvgRate = averageFeeRates.get(p.symbol) || globalAvgRate;

    // Trade is considered high-fee if it's 50% above asset average or 100% above global average
    if (
      feeToNotionalRatio > assetAvgRate * 1.5 ||
      feeToNotionalRatio > globalAvgRate * 2
    ) {
      let reason = "";
      let recommendation = "";

      // Determine reason
      if (p.leverage && p.leverage > 20) {
        reason = "Hoher Hebel (>20x) erhöht Gebührenstruktur";
        recommendation = `Reduzieren Sie den Hebel auf 10-15x für ${p.symbol}, um Gebühren um ca. ${(((feeToNotionalRatio - assetAvgRate) / feeToNotionalRatio) * 100).toFixed(0)}% zu senken.`;
      } else if (feeToNotionalRatio > assetAvgRate * 2) {
        reason = "Wahrscheinlich Market Order statt Limit Order";
        recommendation = `Nutzen Sie Limit-Orders für ${p.symbol}, um Gebühren um bis zu 50% zu reduzieren.`;
      } else if (Math.abs(p.realizedPnl) < p.fee * 2) {
        reason = "Reverse-Trade mit ungünstigem Timing";
        recommendation = `Warten Sie auf bessere Einstiegspunkte bei ${p.symbol}, um Gebühren-zu-PnL-Verhältnis zu verbessern.`;
      } else {
        reason = "Überdurchschnittliche Gebührenrate";
        recommendation = `Prüfen Sie alternative Handelsstrategien für ${p.symbol} zur Gebührenoptimierung.`;
      }

      highFeeTrades.push({
        tradeId: p.tradeId,
        asset: p.symbol,
        feeAmount: p.fee,
        notional,
        feeToNotionalRatio,
        leverage: p.leverage || null,
        pnl: p.realizedPnl,
        direction: getDirectionLabel(p.direction),
        reason,
        recommendation,
      });
    }
  }

  // Sort by fee-to-notional ratio descending
  highFeeTrades.sort((a, b) => b.feeToNotionalRatio - a.feeToNotionalRatio);

  // Calculate efficiency data
  const efficiencyData: FeeEfficiencyData[] = positions.map((p) => {
    const notional = Math.abs(p.entryPrice * p.positionSize);
    const feeToNotionalRatio = notional > 0 ? (p.fee / notional) * 100 : 0;
    const assetAvgRate = averageFeeRates.get(p.symbol) || globalAvgRate;

    // Efficiency score: lower is better (0-100 scale)
    const efficiencyScore =
      assetAvgRate > 0 ? (feeToNotionalRatio / assetAvgRate) * 50 : 50;
    const category: "efficient" | "inefficient" =
      efficiencyScore < 75 ? "efficient" : "inefficient";

    return {
      asset: p.symbol,
      tradeId: p.tradeId,
      efficiencyScore: Math.min(100, efficiencyScore),
      feeAmount: p.fee,
      notional,
      category,
    };
  });

  // Generate category-specific recommendations
  const categoryRecommendations = new Map<string, string[]>();

  // Crypto recommendations
  const cryptoTrades = positions.filter(
    (p) => !isMetal(p.symbol) && !isStablecoin(p.symbol),
  );
  if (cryptoTrades.length > 0) {
    const cryptoRecs: string[] = [];
    const highLevCrypto = cryptoTrades.filter(
      (p) => p.leverage && p.leverage > 30,
    );
    if (highLevCrypto.length > 0) {
      cryptoRecs.push(
        "Krypto-Trades mit Hebel >30x: Reduzieren Sie auf 20-25x für optimale Gebühreneffizienz.",
      );
    }
    const avgCryptoFee =
      cryptoTrades.reduce((sum, p) => sum + p.fee, 0) / cryptoTrades.length;
    if (avgCryptoFee > (globalTotalFees / positions.length) * 1.3) {
      cryptoRecs.push(
        "Krypto-Gebühren überdurchschnittlich: Nutzen Sie verstärkt Limit-Orders und vermeiden Sie Market-Orders in volatilen Phasen.",
      );
    }
    if (cryptoRecs.length > 0) {
      categoryRecommendations.set("Kryptowährungen", cryptoRecs);
    }
  }

  // Metal recommendations
  const metalTrades = positions.filter((p) => isMetal(p.symbol));
  if (metalTrades.length > 0) {
    const metalRecs: string[] = [];
    const highLevMetal = metalTrades.filter(
      (p) => p.leverage && p.leverage > 50,
    );
    if (highLevMetal.length > 0) {
      metalRecs.push(
        "Metall-Trades mit sehr hohem Hebel: Erwägen Sie moderate Hebel (20-40x) für bessere Gebührenstruktur.",
      );
    }
    if (metalRecs.length > 0) {
      categoryRecommendations.set("Metalle", metalRecs);
    }
  }

  // Stablecoin recommendations
  const stablecoinTrades = positions.filter((p) => isStablecoin(p.symbol));
  if (stablecoinTrades.length > 0) {
    const stableRecs: string[] = [];
    const avgStableFee =
      stablecoinTrades.reduce((sum, p) => sum + p.fee, 0) /
      stablecoinTrades.length;
    if (avgStableFee > 0.5) {
      stableRecs.push(
        "Stablecoin-Gebühren: Bei niedrigen Margen sind selbst kleine Gebühren signifikant. Nutzen Sie ausschließlich Limit-Orders.",
      );
    }
    if (stableRecs.length > 0) {
      categoryRecommendations.set("Stablecoins", stableRecs);
    }
  }

  // Direction-specific recommendations using enum comparison
  const longTrades = positions.filter(
    (p) => p.direction === TradeDirectionEnum.long_,
  );
  const shortTrades = positions.filter(
    (p) => p.direction === TradeDirectionEnum.short_,
  );

  if (longTrades.length > 0 && shortTrades.length > 0) {
    const avgLongFee =
      longTrades.reduce((sum, p) => sum + p.fee, 0) / longTrades.length;
    const avgShortFee =
      shortTrades.reduce((sum, p) => sum + p.fee, 0) / shortTrades.length;

    if (Math.abs(avgLongFee - avgShortFee) > (avgLongFee + avgShortFee) / 4) {
      const dirRecs: string[] = [];
      const higherDir = avgLongFee > avgShortFee ? "Long" : "Short";
      const lowerDir = avgLongFee > avgShortFee ? "Short" : "Long";
      dirRecs.push(
        `${higherDir}-Positionen haben signifikant höhere Gebühren. Analysieren Sie Ihre ${higherDir}-Entry-Strategie und orientieren Sie sich an Ihrer ${lowerDir}-Strategie.`,
      );
      categoryRecommendations.set("Handelsrichtung", dirRecs);
    }
  }

  return {
    highFeeTrades,
    averageFeeRates,
    efficiencyData,
    categoryRecommendations,
  };
}

export default function FeeOverview({ positions }: FeeOverviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!positions || positions.length === 0) {
    return null;
  }

  const analysis = analyzeFees(positions);
  const optimization = analyzeOptimization(positions);

  // Fee Alpha analytics
  const netFeeAlpha = calculateNetFeeAlpha(positions);
  const feeAlphaCounts = countByFeeAlphaLabel(positions);
  const assetFeeAlpha = groupByAssetFeeAlpha(positions);
  const directionFeeAlpha = groupByDirectionFeeAlpha(positions);
  const { winners, losers } = getTopFeeAlphaTrades(positions, 5);

  // Chart data for fees by asset
  const assetChartData = analysis.feesByAsset.slice(0, 10).map((a) => ({
    name: a.asset,
    fees: a.totalFees,
  }));

  // Chart data for fees by direction
  const directionChartData = analysis.feesByDirection.map((d) => ({
    name: d.direction,
    fees: d.totalFees,
  }));

  // Chart data for fees by category
  const categoryChartData = analysis.feesByCategory.map((c) => ({
    name: c.categoryName,
    fees: c.totalFees,
  }));

  // Efficiency chart data
  const efficiencyChartData = optimization.efficiencyData
    .sort((a, b) => b.efficiencyScore - a.efficiencyScore)
    .slice(0, 20);

  const COLORS = {
    primary: "oklch(0.65 0.22 264)",
    long: "oklch(0.68 0.20 145)",
    short: "oklch(0.62 0.26 25)",
    crypto: "oklch(0.65 0.22 264)",
    metal: "oklch(0.75 0.15 85)",
    stablecoin: "oklch(0.60 0.20 220)",
    efficient: "oklch(0.68 0.20 145)",
    inefficient: "oklch(0.62 0.26 25)",
    captured: "oklch(0.68 0.20 145)",
    paid: "oklch(0.62 0.26 25)",
    neutral: "oklch(0.65 0 0)",
  };

  const DIRECTION_COLORS = [COLORS.long, COLORS.short];
  const CATEGORY_COLORS = [COLORS.crypto, COLORS.metal, COLORS.stablecoin];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">
            {payload[0].payload.name}
          </p>
          <p className="text-sm font-bold text-primary">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const EfficiencyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{data.asset}</p>
          <p className="text-xs text-muted-foreground">
            Effizienz-Score: {data.efficiencyScore.toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground">
            Gebühr: {formatCurrency(data.feeAmount)}
          </p>
          <p className="text-xs">
            <Badge
              variant={
                data.category === "efficient" ? "default" : "destructive"
              }
              className="text-xs"
            >
              {data.category === "efficient" ? "Effizient" : "Ineffizient"}
            </Badge>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <img
                src="/assets/generated/fee-analysis-icon-transparent.dim_64x64.png"
                alt="Gebührenanalyse"
                className="w-8 h-8"
              />
            </div>
            <div>
              <CardTitle className="text-xl">Gebührenanalyse</CardTitle>
              <CardDescription>
                Umfassende Übersicht und Optimierungsanalyse Ihrer
                Handelsgebühren
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2"
          >
            {isExpanded ? (
              <>
                Einklappen <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Erweitern <ChevronDown className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Gesamtgebühren
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(analysis.totalFees)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Durchschnitt pro Trade
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(analysis.averageFee)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Analysierte Trades
                    </p>
                    <p className="text-2xl font-bold">{positions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`${netFeeAlpha >= 0 ? "bg-success/10" : "bg-destructive/10"}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {netFeeAlpha >= 0 ? (
                    <TrendingUp className="w-8 h-8 text-success" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Net Fee Alpha
                    </p>
                    <p
                      className={`text-2xl font-bold ${netFeeAlpha >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {formatFeeAlphaScore(netFeeAlpha)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fee Alpha Summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">Fee Alpha Übersicht</CardTitle>
              <CardDescription>
                Verteilung der Trades nach Gebühreneffizienz
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-sm text-muted-foreground">
                    Captured (Rebates)
                  </p>
                  <p className="text-2xl font-bold text-success">
                    {feeAlphaCounts.Captured}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(
                      (feeAlphaCounts.Captured / positions.length) *
                      100
                    ).toFixed(1)}
                    % aller Trades
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-muted-foreground">
                    Paid (Gebühren)
                  </p>
                  <p className="text-2xl font-bold text-destructive">
                    {feeAlphaCounts.Paid}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((feeAlphaCounts.Paid / positions.length) * 100).toFixed(
                      1,
                    )}
                    % aller Trades
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground">Neutral</p>
                  <p className="text-2xl font-bold text-muted-foreground">
                    {feeAlphaCounts.Neutral}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(
                      (feeAlphaCounts.Neutral / positions.length) *
                      100
                    ).toFixed(1)}
                    % aller Trades
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Tabs for Overview and Optimization Analysis */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview" className="gap-2">
                <img
                  src="/assets/generated/fee-chart-icon-transparent.dim_32x32.png"
                  alt="Übersicht"
                  className="w-4 h-4"
                />
                Übersicht
              </TabsTrigger>
              <TabsTrigger value="optimization" className="gap-2">
                <img
                  src="/assets/generated/fee-efficiency-icon-transparent.dim_64x64.png"
                  alt="Optimierung"
                  className="w-4 h-4"
                />
                Optimierungsanalyse
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Fee Alpha by Asset */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Fee Alpha nach Asset
                  </CardTitle>
                  <CardDescription>
                    Net Fee Alpha Score pro Asset (höher = besser)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {assetFeeAlpha.slice(0, 10).map((item, index) => (
                      <div
                        key={item.asset}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className="w-8 h-8 flex items-center justify-center"
                          >
                            {index + 1}
                          </Badge>
                          <div>
                            <p className="font-medium">{item.asset}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.tradeCount} Trades • Captured:{" "}
                              {item.capturedCount} • Paid: {item.paidCount}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-bold text-lg ${item.netFeeAlpha >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            {formatFeeAlphaScore(item.netFeeAlpha)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Fee Alpha
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Fee Alpha by Direction */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Fee Alpha nach Richtung
                  </CardTitle>
                  <CardDescription>
                    Vergleich Long vs. Short Gebühreneffizienz
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {directionFeeAlpha.map((item) => (
                      <div
                        key={item.directionLabel}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          {item.direction === TradeDirectionEnum.long_ ? (
                            <TrendingUp className="w-6 h-6 text-success" />
                          ) : (
                            <TrendingDown className="w-6 h-6 text-destructive" />
                          )}
                          <div>
                            <p className="font-semibold text-lg">
                              {item.directionLabel}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.tradeCount} Trades • Captured:{" "}
                              {item.capturedCount} • Paid: {item.paidCount}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-bold text-xl ${item.netFeeAlpha >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            {formatFeeAlphaScore(item.netFeeAlpha)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Net Fee Alpha
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Fee Alpha Winners */}
              {winners.length > 0 && (
                <Card className="border-success/30 bg-success/5">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-success" />
                      Top Fee Alpha Winners (Rebates kassiert)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {winners.map(({ position, alpha }, index) => (
                        <div
                          key={position.tradeId}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className="w-8 h-8 flex items-center justify-center bg-success/10"
                            >
                              {index + 1}
                            </Badge>
                            <div>
                              <p className="font-medium">{position.symbol}</p>
                              <p className="text-sm text-muted-foreground">
                                Gebühr:{" "}
                                <span className="font-bold text-success">
                                  {formatCurrency(position.fee)}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-success">
                              {formatFeeAlphaScore(alpha.score)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Score
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Fee Alpha Losers */}
              {losers.length > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-destructive" />
                      Top Fee Alpha Losers (Höchste Gebühren)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {losers.map(({ position, alpha }, index) => (
                        <div
                          key={position.tradeId}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className="w-8 h-8 flex items-center justify-center bg-destructive/10"
                            >
                              {index + 1}
                            </Badge>
                            <div>
                              <p className="font-medium">{position.symbol}</p>
                              <p className="text-sm text-muted-foreground">
                                Gebühr:{" "}
                                <span className="font-bold text-destructive">
                                  {formatCurrency(position.fee)}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-destructive">
                              {formatFeeAlphaScore(alpha.score)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Score
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fees by Asset */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <img
                        src="/assets/generated/fee-chart-icon-transparent.dim_32x32.png"
                        alt="Chart"
                        className="w-5 h-5"
                      />
                      Gebühren nach Asset
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={assetChartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="oklch(1 0 0 / 12%)"
                        />
                        <XAxis
                          dataKey="name"
                          stroke="oklch(0.65 0 0)"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          stroke="oklch(0.65 0 0)"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `$${value.toFixed(0)}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="fees"
                          fill={COLORS.primary}
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Fees by Direction */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <img
                        src="/assets/generated/fee-chart-icon-transparent.dim_32x32.png"
                        alt="Chart"
                        className="w-5 h-5"
                      />
                      Gebühren nach Richtung
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={directionChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={100}
                          fill={COLORS.primary}
                          dataKey="fees"
                        >
                          {directionChartData.map((entry, index) => (
                            <Cell
                              key={`cell-dir-${entry.name}`}
                              fill={
                                DIRECTION_COLORS[
                                  index % DIRECTION_COLORS.length
                                ]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Fees by Category */}
                {analysis.feesByCategory.length > 1 && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <img
                          src="/assets/generated/fee-chart-icon-transparent.dim_32x32.png"
                          alt="Chart"
                          className="w-5 h-5"
                        />
                        Gebühren nach Kategorie
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) =>
                              `${name}: ${(percent * 100).toFixed(0)}%`
                            }
                            outerRadius={100}
                            fill={COLORS.primary}
                            dataKey="fees"
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell
                                key={`cell-cat-${entry.name}`}
                                fill={
                                  CATEGORY_COLORS[
                                    index % CATEGORY_COLORS.length
                                  ]
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator />

              {/* Top 5 Trades by Fee */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Top 5 Trades mit höchsten Gebühren
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.topTradesByFee.map((trade, index) => (
                      <div
                        key={trade.tradeId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className="w-8 h-8 flex items-center justify-center"
                          >
                            {index + 1}
                          </Badge>
                          <div>
                            <p className="font-medium">{trade.asset}</p>
                            <p className="text-sm text-muted-foreground">
                              Hebel:{" "}
                              {trade.leverage
                                ? `${trade.leverage.toFixed(2)}x`
                                : "N/A"}{" "}
                              • PnL:{" "}
                              <span
                                className={
                                  trade.pnl >= 0
                                    ? "text-success"
                                    : "text-destructive"
                                }
                              >
                                {formatCurrency(trade.pnl)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {formatCurrency(trade.feeAmount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Gebühr
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Recommendations */}
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <img
                      src="/assets/generated/optimization-recommendation-icon-transparent.dim_32x32.png"
                      alt="Empfehlungen"
                      className="w-5 h-5"
                    />
                    Empfehlungen zur Gebührenoptimierung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.recommendations.map((recommendation) => (
                      <Alert
                        key={recommendation.slice(0, 40)}
                        className="border-primary/20"
                      >
                        <Lightbulb className="h-4 w-4 text-primary" />
                        <AlertDescription className="ml-2">
                          {recommendation}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Optimization Analysis Tab */}
            <TabsContent value="optimization" className="space-y-6 mt-6">
              {/* High Fee Trades Analysis */}
              {optimization.highFeeTrades.length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-destructive" />
                      <CardTitle className="text-base">
                        Trades mit überdurchschnittlich hohen Gebühren (
                        {optimization.highFeeTrades.length})
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Diese Trades haben Gebühren, die signifikant über dem
                      Durchschnitt liegen
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {optimization.highFeeTrades.slice(0, 10).map((trade) => (
                        <Card key={trade.tradeId} className="bg-muted/30">
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-lg">
                                      {trade.asset}
                                    </p>
                                    <Badge variant="outline">
                                      {trade.direction}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Gebühr:{" "}
                                    <span className="font-bold text-destructive">
                                      {formatCurrency(trade.feeAmount)}
                                    </span>{" "}
                                    ({trade.feeToNotionalRatio.toFixed(3)}% vom
                                    Notional)
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">
                                    Hebel
                                  </p>
                                  <p className="font-bold">
                                    {trade.leverage
                                      ? `${trade.leverage.toFixed(2)}x`
                                      : "N/A"}
                                  </p>
                                </div>
                              </div>

                              <Separator />

                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-warning">
                                      Ursache:
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {trade.reason}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2">
                                  <Target className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-primary">
                                      Empfehlung:
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {trade.recommendation}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fee Efficiency Chart */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <img
                      src="/assets/generated/fee-efficiency-icon-transparent.dim_64x64.png"
                      alt="Effizienz"
                      className="w-5 h-5"
                    />
                    <CardTitle className="text-base">
                      Gebühren-Effizienz-Analyse
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Visualisierung der Gebühreneffizienz pro Trade (niedrigerer
                    Score = effizienter)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={efficiencyChartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="oklch(1 0 0 / 12%)"
                      />
                      <XAxis
                        dataKey="asset"
                        stroke="oklch(0.65 0 0)"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        stroke="oklch(0.65 0 0)"
                        tick={{ fontSize: 12 }}
                        label={{
                          value: "Effizienz-Score",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip content={<EfficiencyTooltip />} />
                      <Bar dataKey="efficiencyScore" radius={[8, 8, 0, 0]}>
                        {efficiencyChartData.map((entry) => (
                          <Cell
                            key={`cell-eff-${entry.asset ?? entry.category}`}
                            fill={
                              entry.category === "efficient"
                                ? COLORS.efficient
                                : COLORS.inefficient
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS.efficient }}
                      />
                      <span className="text-sm text-muted-foreground">
                        Effizient (&lt;75)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS.inefficient }}
                      />
                      <span className="text-sm text-muted-foreground">
                        Ineffizient (≥75)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category-Specific Recommendations */}
              {optimization.categoryRecommendations.size > 0 && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-primary" />
                      Kategorien-spezifische Optimierungsempfehlungen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Array.from(
                        optimization.categoryRecommendations.entries(),
                      ).map(([category, recs]) => (
                        <div key={category} className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Badge variant="outline">{category}</Badge>
                          </h4>
                          <div className="space-y-2 ml-2">
                            {recs.map((rec) => (
                              <Alert
                                key={rec.slice(0, 40)}
                                className="border-primary/20"
                              >
                                <Target className="h-4 w-4 text-primary" />
                                <AlertDescription className="ml-2 text-sm">
                                  {rec}
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Summary Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Effizienz-Zusammenfassung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <p className="text-sm text-muted-foreground">
                        Effiziente Trades
                      </p>
                      <p className="text-2xl font-bold text-success">
                        {
                          optimization.efficiencyData.filter(
                            (d) => d.category === "efficient",
                          ).length
                        }
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(
                          (optimization.efficiencyData.filter(
                            (d) => d.category === "efficient",
                          ).length /
                            optimization.efficiencyData.length) *
                          100
                        ).toFixed(1)}
                        % aller Trades
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-muted-foreground">
                        Ineffiziente Trades
                      </p>
                      <p className="text-2xl font-bold text-destructive">
                        {
                          optimization.efficiencyData.filter(
                            (d) => d.category === "inefficient",
                          ).length
                        }
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(
                          (optimization.efficiencyData.filter(
                            (d) => d.category === "inefficient",
                          ).length /
                            optimization.efficiencyData.length) *
                          100
                        ).toFixed(1)}
                        % aller Trades
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-sm text-muted-foreground">
                        Einsparpotenzial
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(
                          optimization.highFeeTrades.reduce((sum, t) => {
                            const avgRate =
                              optimization.averageFeeRates.get(t.asset) || 0;
                            const expectedFee = (t.notional * avgRate) / 100;
                            return sum + Math.max(0, t.feeAmount - expectedFee);
                          }, 0),
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Bei Optimierung der ineffizienten Trades
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
