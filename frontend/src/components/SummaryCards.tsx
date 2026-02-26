import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Coins, CircleDollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TradeSummary, TradePosition } from '../backend';
import { formatCurrency, getRiskLevelColor, getRiskLevelLabel, calculateFilteredSummary, getMetalPositions, getStablecoinPositions } from '../lib/utils';

interface SummaryCardsProps {
  summary: TradeSummary;
  positions: TradePosition[];
  selectedAsset: string | null;
}

export default function SummaryCards({ summary, positions, selectedAsset }: SummaryCardsProps) {
  const displaySummary = selectedAsset 
    ? calculateFilteredSummary(positions)
    : summary;

  const liquidationRate = displaySummary.totalPositions > 0n 
    ? (Number(displaySummary.liquidatedPositions) / Number(displaySummary.totalPositions)) * 100 
    : 0;

  const metalPositions = getMetalPositions(positions);
  const hasMetals = metalPositions.length > 0;
  
  const stablecoinPositions = getStablecoinPositions(positions);
  const hasStablecoins = stablecoinPositions.length > 0;
  const totalStablecoinsPnl = stablecoinPositions.reduce((sum, p) => sum + p.realizedPnl + p.unrealizedPnl, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Positions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {selectedAsset ? `${selectedAsset} Positionen` : 'Gesamtpositionen'}
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Number(displaySummary.totalPositions)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Analysierte Trades
          </p>
        </CardContent>
      </Card>

      {/* Liquidated Positions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Liquidierte Positionen</CardTitle>
          <TrendingDown className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {Number(displaySummary.liquidatedPositions)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {liquidationRate.toFixed(1)}% Liquidationsrate
          </p>
        </CardContent>
      </Card>

      {/* Total PnL */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {selectedAsset ? `${selectedAsset} PnL` : 'Gesamt-PnL'}
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${displaySummary.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(displaySummary.totalPnl)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Realisiert + Unrealisiert
          </p>
        </CardContent>
      </Card>

      {/* Metals PnL - Only show if there are metal positions and no specific asset is selected */}
      {hasMetals && !selectedAsset && (
        <Card className="bg-gradient-to-br from-amber-500/10 via-slate-500/10 to-orange-600/10 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              Metalle PnL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${displaySummary.totalMetalsPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(displaySummary.totalMetalsPnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metalPositions.length} Metall-Trade{metalPositions.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stablecoins PnL - Only show if there are stablecoin positions and no specific asset is selected */}
      {hasStablecoins && !selectedAsset && (
        <Card className="bg-gradient-to-br from-blue-500/10 via-green-500/10 to-purple-500/10 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-blue-500" />
              Stablecoins PnL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalStablecoinsPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(totalStablecoinsPnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stablecoinPositions.length} Stablecoin-Trade{stablecoinPositions.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Average Risk Level */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Durchschn. Risiko</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getRiskLevelColor(displaySummary.averageRiskLevel)}`}>
            {getRiskLevelLabel(displaySummary.averageRiskLevel)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Margin: {formatCurrency(displaySummary.totalMargin)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
