import { useState } from 'react';
import { ArrowLeft, Download, TrendingUp, TrendingDown, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PositionStatus } from '../backend';
import SummaryCards from './SummaryCards';
import ChartsSection from './ChartsSection';
import PositionsTable from './PositionsTable';
import AssetSelector from './AssetSelector';
import FeeOverview from './FeeOverview';
import type { AnalysisData } from '../App';
import { exportToCSV } from '../lib/csvExporter';
import { getFilteredPositions } from '../lib/utils';
import { toast } from 'sonner';

interface AnalysisResultsProps {
  data: AnalysisData;
  onReset: () => void;
  selectedAsset: string | null;
  onAssetChange: (asset: string | null) => void;
}

export default function AnalysisResults({ data, onReset, selectedAsset, onAssetChange }: AnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState('all');

  const handleExport = () => {
    try {
      exportToCSV(data);
      toast.success('Analyseergebnisse erfolgreich exportiert!');
    } catch (err) {
      console.error('[AnalysisResults] Export-Fehler:', err);
      toast.error('Fehler beim Exportieren der Daten');
    }
  };

  // Validate data
  if (!data || !data.positions || data.positions.length === 0) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>
            Keine Daten zum Anzeigen verfügbar. Bitte laden Sie eine CSV-Datei hoch.
          </AlertDescription>
        </Alert>
        <div className="text-center">
          <Button onClick={onReset}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zum Upload
          </Button>
        </div>
      </div>
    );
  }

  // Filter positions by selected asset
  const filteredPositions = getFilteredPositions(data.positions, selectedAsset);

  const liquidatedPositions = filteredPositions.filter(p => p.isLiquidated);
  const safePositions = filteredPositions.filter(p => !p.isLiquidated && p.status === PositionStatus.safe);
  const atRiskPositions = filteredPositions.filter(p => !p.isLiquidated && p.status === PositionStatus.atRisk);

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="space-y-6 pb-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Analyseergebnisse</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Datei: {data.fileName || 'Unbekannt'} • {filteredPositions.length} Position{filteredPositions.length !== 1 ? 'en' : ''}
              {selectedAsset && ` • ${selectedAsset}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Exportieren
            </Button>
            <Button variant="outline" onClick={onReset}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Neue Analyse
            </Button>
          </div>
        </div>

        {/* Asset Selector */}
        <AssetSelector 
          positions={data.positions}
          selectedAsset={selectedAsset}
          onAssetChange={onAssetChange}
        />

        {/* Summary Cards */}
        {data.summary && (
          <SummaryCards 
            summary={data.summary} 
            positions={filteredPositions}
            selectedAsset={selectedAsset}
          />
        )}

        {/* Fee Overview */}
        <FeeOverview positions={filteredPositions} />

        {/* Charts Section */}
        <ChartsSection 
          positions={filteredPositions}
          allPositions={data.positions}
          selectedAsset={selectedAsset}
          onAssetSelect={onAssetChange}
        />

        {/* Positions Table with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Positionsübersicht</CardTitle>
            <CardDescription>
              Detaillierte Ansicht aller analysierten Handelspositionen
              {selectedAsset && ` für ${selectedAsset}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="hidden sm:inline">Alle</span> ({filteredPositions.length})
                </TabsTrigger>
                <TabsTrigger value="safe" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Sicher</span> ({safePositions.length})
                </TabsTrigger>
                <TabsTrigger value="atRisk" className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="hidden sm:inline">Risiko</span> ({atRiskPositions.length})
                </TabsTrigger>
                <TabsTrigger value="liquidated" className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Liquidiert</span> ({liquidatedPositions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-6">
                {filteredPositions.length > 0 ? (
                  <ScrollArea className="h-[600px] pr-4">
                    <PositionsTable positions={filteredPositions} />
                  </ScrollArea>
                ) : (
                  <Alert>
                    <AlertDescription>
                      {selectedAsset 
                        ? `Keine Positionen für ${selectedAsset} gefunden.`
                        : 'Keine Positionen vorhanden.'}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="safe" className="mt-6">
                {safePositions.length > 0 ? (
                  <ScrollArea className="h-[600px] pr-4">
                    <PositionsTable positions={safePositions} />
                  </ScrollArea>
                ) : (
                  <Alert>
                    <AlertDescription>
                      {selectedAsset 
                        ? `Keine sicheren Positionen für ${selectedAsset} gefunden.`
                        : 'Keine sicheren Positionen gefunden.'}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="atRisk" className="mt-6">
                {atRiskPositions.length > 0 ? (
                  <ScrollArea className="h-[600px] pr-4">
                    <PositionsTable positions={atRiskPositions} />
                  </ScrollArea>
                ) : (
                  <Alert>
                    <AlertDescription>
                      {selectedAsset 
                        ? `Keine Positionen mit Risiko für ${selectedAsset} gefunden.`
                        : 'Keine Positionen mit Risiko gefunden.'}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="liquidated" className="mt-6">
                {liquidatedPositions.length > 0 ? (
                  <ScrollArea className="h-[600px] pr-4">
                    <PositionsTable positions={liquidatedPositions} />
                  </ScrollArea>
                ) : (
                  <Alert>
                    <AlertDescription>
                      {selectedAsset 
                        ? `Keine liquidierten Positionen für ${selectedAsset} gefunden.`
                        : 'Keine liquidierten Positionen gefunden.'}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
