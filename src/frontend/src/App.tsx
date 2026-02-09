import { useState, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from './components/Header';
import Footer from './components/Footer';
import UploadSection from './components/UploadSection';
import AnalysisResults from './components/AnalysisResults';
import OrderbookHeatmapView from './components/OrderbookHeatmapView';
import type { TradePosition, TradeSummary } from './backend';

export interface AnalysisData {
  positions: TradePosition[];
  summary: TradeSummary;
  fileName: string;
}

function App() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [hasRenderError, setHasRenderError] = useState(false);
  const [rootExists, setRootExists] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('analysis');

  // Check if root container exists on mount
  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      setRootExists(false);
      console.error('[App] Root-Container nicht gefunden!');
    }
  }, []);

  const handleAnalysisComplete = (data: AnalysisData) => {
    try {
      if (!data || !data.positions || data.positions.length === 0) {
        throw new Error('Keine gültigen Daten zum Anzeigen');
      }
      setAnalysisData(data);
      setSelectedAsset(null); // Reset asset filter on new analysis
      setHasRenderError(false);
    } catch (error) {
      console.error('[App] Fehler beim Setzen der Analysedaten:', error);
      setHasRenderError(true);
    }
  };

  const handleReset = () => {
    try {
      setAnalysisData(null);
      setSelectedAsset(null);
      setHasRenderError(false);
    } catch (error) {
      console.error('[App] Fehler beim Zurücksetzen:', error);
      setHasRenderError(true);
    }
  };

  // Fallback UI if root container is missing
  if (!rootExists) {
    return (
      <div style={{ 
        padding: '2rem', 
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <h1 style={{ color: '#dc2626', marginBottom: '1rem' }}>Fehler beim Laden der Anwendung</h1>
        <p>Der Root-Container konnte nicht gefunden werden. Bitte laden Sie die Seite neu.</p>
      </div>
    );
  }

  // Fallback UI if rendering fails
  if (hasRenderError) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <div className="min-h-screen flex flex-col bg-background">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-8">
            <Alert variant="destructive" className="max-w-2xl mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fehler beim Rendern</AlertTitle>
              <AlertDescription>
                Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite neu oder versuchen Sie es mit einer anderen CSV-Datei.
              </AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setHasRenderError(false);
                  setAnalysisData(null);
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Zurück zum Upload
              </button>
            </div>
          </main>
          <Footer />
          <Toaster />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
              <TabsTrigger value="analysis">Trade Analysis</TabsTrigger>
              <TabsTrigger value="heatmap">Orderbook Heatmap</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analysis" className="mt-0">
              {!analysisData ? (
                <UploadSection onAnalysisComplete={handleAnalysisComplete} />
              ) : (
                <AnalysisResults 
                  data={analysisData} 
                  onReset={handleReset}
                  selectedAsset={selectedAsset}
                  onAssetChange={setSelectedAsset}
                />
              )}
            </TabsContent>
            
            <TabsContent value="heatmap" className="mt-0">
              <OrderbookHeatmapView />
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default App;
