import { useState, useMemo } from 'react';
import { Filter, X, Coins, CircleDollarSign, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TradePosition } from '../backend';
import { getAvailableAssets, getNonMetalNonStablecoinAssets, getAvailableMetals, getAvailableStablecoins, calculateAssetStats, isMetal, isStablecoin, getMetalIcon, getStablecoinIcon } from '../lib/utils';
import { formatCurrency } from '../lib/utils';

interface AssetSelectorProps {
  positions: TradePosition[];
  selectedAsset: string | null;
  onAssetChange: (asset: string | null) => void;
}

export default function AssetSelector({ positions, selectedAsset, onAssetChange }: AssetSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const availableAssets = getAvailableAssets(positions);
  const metals = getAvailableMetals(positions);
  const stablecoins = getAvailableStablecoins(positions);
  const cryptos = getNonMetalNonStablecoinAssets(positions);
  
  // Filter assets based on search query
  const filteredMetals = useMemo(() => 
    metals.filter(asset => asset.toLowerCase().includes(searchQuery.toLowerCase())),
    [metals, searchQuery]
  );
  
  const filteredStablecoins = useMemo(() => 
    stablecoins.filter(asset => asset.toLowerCase().includes(searchQuery.toLowerCase())),
    [stablecoins, searchQuery]
  );
  
  const filteredCryptos = useMemo(() => 
    cryptos.filter(asset => asset.toLowerCase().includes(searchQuery.toLowerCase())),
    [cryptos, searchQuery]
  );
  
  const assetStats = selectedAsset ? calculateAssetStats(positions, selectedAsset) : null;
  const isMetalSelected = selectedAsset ? isMetal(selectedAsset) : false;
  const isStablecoinSelected = selectedAsset ? isStablecoin(selectedAsset) : false;

  return (
    <Card className={
      isMetalSelected 
        ? 'bg-gradient-to-br from-amber-500/5 via-slate-500/5 to-orange-600/5 border-amber-500/20' 
        : isStablecoinSelected
        ? 'bg-gradient-to-br from-blue-500/5 via-green-500/5 to-purple-500/5 border-blue-500/20'
        : ''
    }>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Asset-Filter
              {isMetalSelected && <Coins className="w-5 h-5 text-amber-500" />}
              {isStablecoinSelected && <CircleDollarSign className="w-5 h-5 text-blue-500" />}
            </CardTitle>
            <CardDescription>
              Wählen Sie ein Asset zur detaillierten Analyse
            </CardDescription>
          </div>
          {selectedAsset && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onAssetChange(null)}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full sm:w-auto space-y-2">
            <label className="text-sm font-medium mb-2 block">Asset auswählen</label>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Asset suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-[250px]"
              />
            </div>
            
            {/* Asset Select with Scrollable Content */}
            <Select value={selectedAsset || 'all'} onValueChange={(value) => onAssetChange(value === 'all' ? null : value)}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Alle Assets" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                <SelectItem value="all">Alle Assets</SelectItem>
                
                {filteredMetals.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Coins className="w-4 h-4" />
                        Metalle
                      </SelectLabel>
                      <div className="max-h-[150px] overflow-y-auto">
                        {filteredMetals.map((asset) => {
                          const icon = getMetalIcon(asset);
                          return (
                            <SelectItem key={asset} value={asset}>
                              <div className="flex items-center gap-2">
                                {icon && <img src={icon} alt={asset} className="w-4 h-4" />}
                                {asset}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </div>
                    </SelectGroup>
                  </>
                )}
                
                {filteredStablecoins.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <CircleDollarSign className="w-4 h-4" />
                        Stablecoins
                      </SelectLabel>
                      <div className="max-h-[150px] overflow-y-auto">
                        {filteredStablecoins.map((asset) => {
                          const icon = getStablecoinIcon();
                          return (
                            <SelectItem key={asset} value={asset}>
                              <div className="flex items-center gap-2">
                                <img src={icon} alt={asset} className="w-4 h-4" />
                                {asset}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </div>
                    </SelectGroup>
                  </>
                )}
                
                {filteredCryptos.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Kryptowährungen</SelectLabel>
                      <div className="max-h-[150px] overflow-y-auto">
                        {filteredCryptos.map((asset) => (
                          <SelectItem key={asset} value={asset}>
                            {asset}
                          </SelectItem>
                        ))}
                      </div>
                    </SelectGroup>
                  </>
                )}
                
                {filteredMetals.length === 0 && filteredStablecoins.length === 0 && filteredCryptos.length === 0 && searchQuery && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Keine Assets gefunden für "{searchQuery}"
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {assetStats && (
            <div className={`flex-1 grid grid-cols-3 gap-4 p-4 rounded-lg ${
              isMetalSelected 
                ? 'bg-gradient-to-br from-amber-500/10 via-slate-500/10 to-orange-600/10 border border-amber-500/20' 
                : isStablecoinSelected
                ? 'bg-gradient-to-br from-blue-500/10 via-green-500/10 to-purple-500/10 border border-blue-500/20'
                : 'bg-muted/50'
            }`}>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Gesamt-PnL</p>
                <p className={`text-lg font-bold ${assetStats.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(assetStats.totalPnl)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ø PnL/Trade</p>
                <p className={`text-lg font-bold ${assetStats.averagePnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(assetStats.averagePnl)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Anzahl Trades</p>
                <p className="text-lg font-bold text-foreground">
                  {assetStats.tradeCount}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
