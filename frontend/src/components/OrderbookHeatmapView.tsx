import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Pause, Play, RefreshCw } from 'lucide-react';
import { useHyperliquidOrderbook } from '@/hooks/useHyperliquidOrderbook';
import OrderbookHeatmapCanvas from './orderbook/OrderbookHeatmapCanvas';

const SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'HYPE', 'XRP', 'DOGE', 'SUI', 'AVAX', 'LINK', 'UNI',
  'AAVE', 'ARB', 'OP', 'MATIC', 'APT', 'LTC', 'BCH', 'XLM', 'ATOM', 'FIL'
];

const DEPTH_OPTIONS = [
  { value: 20, label: '20 levels' },
  { value: 50, label: '50 levels' },
  { value: 100, label: '100 levels' },
  { value: 200, label: '200 levels' },
];

const INTERVAL_OPTIONS = [
  { value: 1000, label: 'Fast (1s)' },
  { value: 2000, label: 'Normal (2s)' },
  { value: 5000, label: 'Slow (5s)' },
  { value: 10000, label: 'Very Slow (10s)' },
  { value: 15000, label: 'Ultra Slow (15s)' },
];

type RenderingMode = 'bars' | 'cluster';

export default function OrderbookHeatmapView() {
  const [symbol, setSymbol] = useState('BTC');
  const [depth, setDepth] = useState(50);
  const [interval, setInterval] = useState(5000);
  const [isPaused, setIsPaused] = useState(false);
  const [renderingMode, setRenderingMode] = useState<RenderingMode>('cluster');

  const { orderbook, isLoading, error, lastUpdated, refetch } = useHyperliquidOrderbook({
    symbol,
    depth,
    interval,
    paused: isPaused,
  });

  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol);
  };

  const handleDepthChange = (newDepth: string) => {
    setDepth(parseInt(newDepth, 10));
  };

  const handleIntervalChange = (newInterval: string) => {
    setInterval(parseInt(newInterval, 10));
  };

  const handleRenderingModeChange = (newMode: string) => {
    setRenderingMode(newMode as RenderingMode);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Orderbook Heatmap</CardTitle>
          <CardDescription>
            Live visualization of Hyperliquid orderbook depth with color-coded intensity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol-select">Symbol</Label>
              <Select value={symbol} onValueChange={handleSymbolChange}>
                <SelectTrigger id="symbol-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map((sym) => (
                    <SelectItem key={sym} value={sym}>
                      {sym}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="depth-select">Depth</Label>
              <Select value={depth.toString()} onValueChange={handleDepthChange}>
                <SelectTrigger id="depth-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPTH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interval-select">Update Interval</Label>
              <Select value={interval.toString()} onValueChange={handleIntervalChange}>
                <SelectTrigger id="interval-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mode-select">Rendering Mode</Label>
              <Select value={renderingMode} onValueChange={handleRenderingModeChange}>
                <SelectTrigger id="mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cluster">Cluster</SelectItem>
                  <SelectItem value="bars">Bars</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Controls</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={togglePause}
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  title="Refresh now"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Last updated: <span className="font-mono">{formatTimestamp(lastUpdated)}</span>
            </div>
            <div>
              Status: <span className={isPaused ? 'text-warning' : 'text-success'}>
                {isPaused ? 'Paused' : 'Live'}
              </span>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && !orderbook && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-[600px] w-full" />
            </div>
          )}

          {/* Heatmap Canvas */}
          {orderbook && (
            <div className="space-y-4">
              <OrderbookHeatmapCanvas
                bids={orderbook.bids}
                asks={orderbook.asks}
                midPrice={orderbook.midPrice}
                symbol={symbol}
                renderingMode={renderingMode}
                updateInterval={interval}
              />
              
              {/* Legend */}
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Legend</h4>
                    {renderingMode === 'cluster' ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ background: 'linear-gradient(to right, oklch(0.75 0.15 145), oklch(0.35 0.20 145))' }} />
                              <span>Bids (Buy orders): Unified green triangle</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ background: 'linear-gradient(to right, oklch(0.75 0.15 25), oklch(0.35 0.20 25))' }} />
                              <span>Asks (Sell orders): Unified red triangle</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Cluster mode displays bids and asks as unified triangles with smooth color gradients. 
                          The larger triangle indicates the dominant side by aggregate depth (buy vs sell pressure). 
                          When more buy orders exist, the green triangle is larger; when more sell orders exist, the red triangle is larger.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ background: 'linear-gradient(to right, oklch(0.75 0.15 145), oklch(0.35 0.20 145))' }} />
                              <span>Bids (Buy orders): Light green = low depth, Dark green = high depth</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ background: 'linear-gradient(to right, oklch(0.75 0.15 25), oklch(0.35 0.20 25))' }} />
                              <span>Asks (Sell orders): Light red = low depth, Dark red = high depth</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          The bars view shows individual price levels with color intensity representing the relative size of orders.
                          The mid price is indicated by a white line separating bids and asks.
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !orderbook && !error && (
            <Alert>
              <AlertDescription>
                No orderbook data available. Please wait for the next update.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
