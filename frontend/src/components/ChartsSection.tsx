import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TradePosition } from '../backend';
import { TradeDirectionEnum, PositionStatus } from '../backend';
import { formatCurrency, getAvailableAssets, isMetal, isStablecoin, getMetalColor, getStablecoinColor, getLongColor, getShortColor, getMetalPositions, getStablecoinPositions, getLongPositions, getShortPositions } from '../lib/utils';
import { Coins, CircleDollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface ChartsSectionProps {
  positions: TradePosition[];
  allPositions: TradePosition[];
  selectedAsset: string | null;
  onAssetSelect: (asset: string | null) => void;
}

export default function ChartsSection({ positions, allPositions, selectedAsset, onAssetSelect }: ChartsSectionProps) {
  // Prepare data for PnL bar chart with Long/Short distinction
  const pnlData = positions.map((position, index) => ({
    name: `Trade ${index + 1}`,
    symbol: position.symbol,
    pnl: position.realizedPnl,
    isMetal: isMetal(position.symbol),
    isStablecoin: isStablecoin(position.symbol),
    isLong: position.direction === TradeDirectionEnum.long_,
  }));

  // Prepare data for trade direction pie chart using enum comparison
  const directionCounts: Record<string, number> = {};
  positions.forEach((position) => {
    const direction = position.isLiquidated ? 'Liquidiert' : 
                     position.status === PositionStatus.safe ? 'Sicher' :
                     position.status === PositionStatus.atRisk ? 'Risiko' : 'Ausstehend';
    directionCounts[direction] = (directionCounts[direction] || 0) + 1;
  });

  const directionData = Object.entries(directionCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Prepare data for Long/Short distribution
  const longPositions = getLongPositions(positions);
  const shortPositions = getShortPositions(positions);
  
  const longShortData = [
    { name: 'Long', value: longPositions.length },
    { name: 'Short', value: shortPositions.length },
  ];

  // Prepare data for liquidation status pie chart
  const liquidatedCount = positions.filter(p => p.isLiquidated).length;
  const nonLiquidatedCount = positions.length - liquidatedCount;
  
  const liquidationData = [
    { name: 'Nicht liquidiert', value: nonLiquidatedCount },
    { name: 'Liquidiert', value: liquidatedCount },
  ];

  // Prepare data for asset distribution (PnL by asset)
  const availableAssets = getAvailableAssets(allPositions);
  const assetPnlData = availableAssets.map(asset => {
    const assetPositions = allPositions.filter(p => p.symbol === asset);
    const totalPnl = assetPositions.reduce((sum, p) => sum + p.realizedPnl, 0);
    const isMetalAsset = isMetal(asset);
    const isStablecoinAsset = isStablecoin(asset);
    return {
      name: asset,
      pnl: totalPnl,
      count: assetPositions.length,
      isMetal: isMetalAsset,
      isStablecoin: isStablecoinAsset,
    };
  }).sort((a, b) => b.pnl - a.pnl);

  // Colors for charts
  const COLORS = {
    positive: 'oklch(0.68 0.20 145)',
    negative: 'oklch(0.62 0.26 25)',
    safe: 'oklch(0.68 0.20 145)',
    atRisk: 'oklch(0.78 0.22 85)',
    liquidated: 'oklch(0.62 0.26 25)',
    pending: 'oklch(0.65 0 0)',
    primary: 'oklch(0.65 0.22 264)',
    accent: 'oklch(0.70 0.24 285)',
  };

  const PIE_COLORS = [
    COLORS.safe,
    COLORS.atRisk,
    COLORS.liquidated,
    COLORS.pending,
  ];

  const LIQUIDATION_COLORS = [
    COLORS.safe,
    COLORS.liquidated,
  ];

  const LONG_SHORT_COLORS = [
    getLongColor(),
    getShortColor(),
  ];

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const isMetalAsset = payload[0].payload.isMetal;
      const isStablecoinAsset = payload[0].payload.isStablecoin;
      const isLong = payload[0].payload.isLong;
      
      return (
        <div className={`border rounded-lg p-3 shadow-lg ${
          isMetalAsset 
            ? 'bg-gradient-to-br from-amber-500/20 via-slate-500/20 to-orange-600/20 border-amber-500/30' 
            : isStablecoinAsset
            ? 'bg-gradient-to-br from-blue-500/20 via-green-500/20 to-purple-500/20 border-blue-500/30'
            : 'bg-popover border-border'
        }`}>
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            {payload[0].payload.symbol}
            {isMetalAsset && <Coins className="w-4 h-4 text-amber-500" />}
            {isStablecoinAsset && <CircleDollarSign className="w-4 h-4 text-blue-500" />}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isLong ? 'Long' : 'Short'}
          </p>
          <p className={`text-sm font-bold ${payload[0].value >= 0 ? 'text-success' : 'text-destructive'}`}>
            PnL: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for pie chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
          <p className="text-sm font-bold text-foreground">
            Anzahl: {payload[0].value}
          </p>
          <p className="text-xs text-muted-foreground">
            {((payload[0].value / positions.length) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for asset PnL chart
  const CustomAssetTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const isMetalAsset = payload[0].payload.isMetal;
      const isStablecoinAsset = payload[0].payload.isStablecoin;
      
      return (
        <div className={`border rounded-lg p-3 shadow-lg ${
          isMetalAsset 
            ? 'bg-gradient-to-br from-amber-500/20 via-slate-500/20 to-orange-600/20 border-amber-500/30' 
            : isStablecoinAsset
            ? 'bg-gradient-to-br from-blue-500/20 via-green-500/20 to-purple-500/20 border-blue-500/30'
            : 'bg-popover border-border'
        }`}>
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            {payload[0].payload.name}
            {isMetalAsset && <Coins className="w-4 h-4 text-amber-500" />}
            {isStablecoinAsset && <CircleDollarSign className="w-4 h-4 text-blue-500" />}
          </p>
          <p className={`text-sm font-bold ${payload[0].value >= 0 ? 'text-success' : 'text-destructive'}`}>
            PnL: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-xs text-muted-foreground">
            Trades: {payload[0].payload.count}
          </p>
        </div>
      );
    }
    return null;
  };

  // Handle bar click for asset selection
  const handleAssetBarClick = (data: any) => {
    if (data && data.name) {
      const clickedAsset = data.name;
      onAssetSelect(selectedAsset === clickedAsset ? null : clickedAsset);
    }
  };

  // Get color for asset bar
  const getAssetBarColor = (entry: any) => {
    if (entry.isMetal) {
      return getMetalColor(entry.name);
    }
    if (entry.isStablecoin) {
      return getStablecoinColor(entry.name);
    }
    return entry.pnl >= 0 ? COLORS.positive : COLORS.negative;
  };

  // Get color for PnL bar based on type and direction
  const getPnlBarColor = (entry: any) => {
    if (entry.isMetal) {
      return getMetalColor(entry.symbol);
    }
    if (entry.isStablecoin) {
      return getStablecoinColor(entry.symbol);
    }
    // Use Long/Short colors for regular crypto
    return entry.isLong ? getLongColor() : getShortColor();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Asset PnL Bar Chart - Only show if no asset is selected */}
      {!selectedAsset && (
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              PnL nach Asset
              {getMetalPositions(allPositions).length > 0 && (
                <Coins className="w-5 h-5 text-amber-500" />
              )}
              {getStablecoinPositions(allPositions).length > 0 && (
                <CircleDollarSign className="w-5 h-5 text-blue-500" />
              )}
            </CardTitle>
            <CardDescription>
              Gesamter Gewinn/Verlust pro Asset (klicken zum Filtern) • Metalle & Stablecoins hervorgehoben
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={assetPnlData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 12%)" />
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
                <Tooltip content={<CustomAssetTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Bar 
                  dataKey="pnl" 
                  name="PnL ($)"
                  fill={COLORS.primary}
                  radius={[8, 8, 0, 0]}
                  onClick={handleAssetBarClick}
                  cursor="pointer"
                >
                  {assetPnlData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getAssetBarColor(entry)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* PnL Bar Chart with Long/Short distinction */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectedAsset ? `${selectedAsset} - Gewinne und Verluste` : 'Gewinne und Verluste'}
            {selectedAsset && isMetal(selectedAsset) && (
              <Coins className="w-5 h-5 text-amber-500" />
            )}
            {selectedAsset && isStablecoin(selectedAsset) && (
              <CircleDollarSign className="w-5 h-5 text-blue-500" />
            )}
          </CardTitle>
          <CardDescription>
            Realisierte PnL für jeden Trade • Grün = Long, Rot = Short
            {selectedAsset && isMetal(selectedAsset) && ' • Metall-Asset'}
            {selectedAsset && isStablecoin(selectedAsset) && ' • Stablecoin-Asset'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={pnlData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 12%)" />
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
              <Tooltip content={<CustomBarTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
              <Bar 
                dataKey="pnl" 
                name="PnL ($)"
                fill={COLORS.primary}
                radius={[8, 8, 0, 0]}
              >
                {pnlData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getPnlBarColor(entry)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Long/Short Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <TrendingDown className="w-5 h-5 text-destructive" />
            Long/Short Verteilung
          </CardTitle>
          <CardDescription>
            Verteilung nach Handelsrichtung
            {selectedAsset && ` für ${selectedAsset}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={longShortData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill={COLORS.primary}
                dataKey="value"
              >
                {longShortData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={LONG_SHORT_COLORS[index % LONG_SHORT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Trade Status Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Positionsstatus</CardTitle>
          <CardDescription>
            Verteilung nach Status
            {selectedAsset && ` für ${selectedAsset}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={directionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill={COLORS.primary}
                dataKey="value"
              >
                {directionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Liquidation Status Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Liquidationsstatus</CardTitle>
          <CardDescription>
            Liquidierte vs. Nicht-liquidierte Positionen
            {selectedAsset && ` für ${selectedAsset}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={liquidationData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill={COLORS.primary}
                dataKey="value"
              >
                {liquidationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={LIQUIDATION_COLORS[index % LIQUIDATION_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
