import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, FileText, Info, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { AnalysisData } from "../App";
import { parseCSV } from "../lib/csvParser";

interface UploadSectionProps {
  onAnalysisComplete: (data: AnalysisData) => void;
}

export default function UploadSection({
  onAnalysisComplete,
}: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsProcessing(true);

      try {
        if (!file) {
          throw new Error("Keine Datei ausgewählt");
        }

        if (!file.name.endsWith(".csv")) {
          throw new Error("Bitte laden Sie eine CSV-Datei hoch");
        }

        if (file.size === 0) {
          throw new Error("Die Datei ist leer");
        }

        if (file.size > 10 * 1024 * 1024) {
          // 10MB limit
          throw new Error("Die Datei ist zu groß (Maximum: 10MB)");
        }

        const text = await file.text();

        if (!text || text.trim().length === 0) {
          throw new Error("Die CSV-Datei enthält keine Daten");
        }

        const result = parseCSV(text, file.name);

        if (!result || !result.positions) {
          throw new Error("Fehler beim Parsen der CSV-Datei");
        }

        if (result.positions.length === 0) {
          throw new Error(
            "Keine gültigen Positionen in der CSV-Datei gefunden. Bitte überprüfen Sie das Format.",
          );
        }

        onAnalysisComplete(result);
        toast.success(
          `CSV-Datei erfolgreich analysiert! ${result.positions.length} Position(en) gefunden.`,
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Fehler beim Verarbeiten der Datei";
        console.error("[UploadSection] Fehler:", err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    },
    [onAnalysisComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      } else {
        setError("Keine Datei erkannt. Bitte versuchen Sie es erneut.");
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <img
          src="/assets/generated/analytics-hero.dim_800x400.png"
          alt="Analytics Hero"
          className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
          onError={(e) => {
            // Hide image if it fails to load
            e.currentTarget.style.display = "none";
          }}
        />
        <h2 className="text-3xl font-bold text-foreground">
          Analysieren Sie Ihre Hyperliquid Trades
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Laden Sie Ihre CSV-Datei hoch, um detaillierte Einblicke in Ihre
          Handelspositionen zu erhalten. Erkennen Sie liquidierte Positionen und
          verstehen Sie die Ursachen.
        </p>
      </div>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            CSV-Datei hochladen
          </CardTitle>
          <CardDescription>
            Ziehen Sie Ihre Hyperliquid Trade-Daten hierher oder klicken Sie zum
            Auswählen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center transition-all
              ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-border hover:border-primary/50 hover:bg-accent/5"
              }
              ${isProcessing ? "opacity-50 pointer-events-none" : "cursor-pointer"}
            `}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
              aria-label="CSV-Datei auswählen"
            />

            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                {isProcessing ? (
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-primary" />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {isProcessing
                    ? "Verarbeite Datei..."
                    : "CSV-Datei hier ablegen"}
                </p>
                <p className="text-sm text-muted-foreground">
                  oder klicken Sie, um eine Datei auszuwählen
                </p>
              </div>

              <Button
                variant="outline"
                disabled={isProcessing}
                className="pointer-events-none"
              >
                <img
                  src="/assets/generated/csv-icon-transparent.dim_64x64.png"
                  alt=""
                  className="w-5 h-5 mr-2"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                Datei auswählen
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fehler</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!error && !isProcessing && (
            <Alert className="mt-4 border-blue-500/50 bg-blue-500/10">
              <Info className="h-4 w-4 text-blue-500" />
              <AlertTitle className="text-blue-500">Hinweis</AlertTitle>
              <AlertDescription className="text-blue-500/90">
                Unterstützt deutsche und englische CSV-Formate mit verschiedenen
                Zahlenformaten und Trennzeichen.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Info Section */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Erwartetes CSV-Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Ihre CSV-Datei sollte folgende Spalten enthalten (deutsche oder
            englische Bezeichnungen):
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Trade ID / Position ID</strong> - Eindeutige Kennung der
              Position
            </li>
            <li>
              <strong>Symbol / Handelspaar</strong> - z.B. BTC/USD, ETH/USD
            </li>
            <li>
              <strong>Positionsgröße / Position Size</strong> - Größe der
              Position
            </li>
            <li>
              <strong>Einstiegspreis / Entry Price</strong> - Preis beim
              Einstieg
            </li>
            <li>
              <strong>Liquidationspreis / Liquidation Price</strong> -
              Liquidationsschwelle (optional)
            </li>
            <li>
              <strong>Gewinn/Verlust / Realized PnL</strong> - Realisierter
              Gewinn/Verlust
            </li>
            <li>
              <strong>Unrealisierter PnL / Unrealized PnL</strong> - Nicht
              realisierter Gewinn/Verlust (optional)
            </li>
            <li>
              <strong>Verwendete Margin / Margin Used</strong> - Eingesetzte
              Margin
            </li>
            <li>
              <strong>Hebel / Leverage</strong> - Verwendeter Hebel
            </li>
          </ul>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="font-medium text-foreground mb-2">
              Unterstützte Formate:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Komma-getrennt (,) oder Semikolon-getrennt (;)</li>
              <li>
                Deutsche Zahlenformate:{" "}
                <code className="bg-muted px-1 py-0.5 rounded">1.234,56</code>
              </li>
              <li>
                Englische Zahlenformate:{" "}
                <code className="bg-muted px-1 py-0.5 rounded">1,234.56</code>
              </li>
              <li>
                Hyperliquid-Format mit Spalten: coin, px, sz, ntl, fee,
                closedPnl, dir
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
