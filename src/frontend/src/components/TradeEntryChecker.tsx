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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSETS_NOT_ON_HL_PERPS,
  ASSET_ALIASES,
  type HyperliquidLiveData,
  fetchHyperliquidLiveData,
} from "@/lib/hyperliquidApi";
import {
  type CVDSignal,
  type EMAAlignment,
  type EntryEvaluationResult,
  type FundingLevel,
  type LiquidationsNear,
  type MACDDirection,
  type OIDirection,
  type RSITimeframe,
  type Timeframe,
  type TradeDirection,
  evaluateEntryConditions,
  validateATR,
  validateAssetName,
  validatePrice,
  validateRSI,
} from "@/lib/tradeEntryRules";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRef, useState } from "react";
import EntryChecklistResults from "./EntryChecklistResults";

interface FormValues {
  assetName: string;
  tradeDirection: TradeDirection;
  rsiTimeframe: RSITimeframe;
  // Section 2: auto-fetched or manual
  currentPrice: string;
  oiDirection: OIDirection | "";
  fundingLevel: FundingLevel | "";
  futureCVD: CVDSignal | "";
  // Section 3: from chart
  emaAlignment: EMAAlignment | "";
  rsi: string;
  atr: string;
  macdDirection: MACDDirection;
  // Section 4: Kiyotaka
  liquidationsNear: LiquidationsNear | "";
}

interface FormErrors {
  assetName?: string;
  currentPrice?: string;
  emaAlignment?: string;
  rsi?: string;
  atr?: string;
}

const defaultValues: FormValues = {
  assetName: "",
  tradeDirection: "Long",
  rsiTimeframe: "1m",
  currentPrice: "",
  oiDirection: "",
  fundingLevel: "",
  futureCVD: "",
  emaAlignment: "",
  rsi: "",
  atr: "",
  macdDirection: "Neutral",
  liquidationsNear: "",
};

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
];

function formatPrice(price: number): string {
  if (price >= 10000) return price.toFixed(0);
  if (price >= 1000) return price.toFixed(1);
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(3);
  return price.toFixed(4);
}

function formatFundingRate(rawFunding: number): string {
  return `${(rawFunding * 100).toFixed(4)}% / 8h`;
}

const OI_LABELS: Record<string, { label: string; color: string }> = {
  rising: { label: "OI steigt ↑", color: "text-emerald-400" },
  neutral: { label: "OI neutral →", color: "text-muted-foreground" },
  falling: { label: "OI fällt ↓", color: "text-red-400" },
};

const FUNDING_LABELS: Record<string, { label: string; color: string }> = {
  strongPositive: { label: "Funding hoch +", color: "text-red-400" },
  neutral: { label: "Funding neutral", color: "text-muted-foreground" },
  strongNegative: { label: "Funding negativ −", color: "text-emerald-400" },
};

const CVD_LABELS: Record<string, { label: string; color: string }> = {
  bullish: { label: "CVD bullish", color: "text-emerald-400" },
  neutral: { label: "CVD neutral", color: "text-muted-foreground" },
  bearish: { label: "CVD bearish", color: "text-red-400" },
};

export default function TradeEntryChecker() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [form, setForm] = useState<FormValues>(defaultValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<EntryEvaluationResult | null>(null);
  const [submittedTimeframe, setSubmittedTimeframe] = useState<Timeframe>("1m");

  const [liveDataStatus, setLiveDataStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [liveDataError, setLiveDataError] = useState<string>("");
  const [liveDataRaw, setLiveDataRaw] = useState<HyperliquidLiveData | null>(
    null,
  );

  const resultsRef = useRef<HTMLDivElement>(null);

  const isManualOnlyAsset = (name: string): boolean => {
    const raw = name.split("/")[0].split("-")[0].trim().toUpperCase();
    const resolved = ASSET_ALIASES[raw] ?? raw;
    return (
      ASSETS_NOT_ON_HL_PERPS.has(raw) || ASSETS_NOT_ON_HL_PERPS.has(resolved)
    );
  };

  const TV_LINKS: Record<string, string> = {
    SILVER: "https://www.tradingview.com/chart/?symbol=XAGUSD",
    XAG: "https://www.tradingview.com/chart/?symbol=XAGUSD",
    SILBER: "https://www.tradingview.com/chart/?symbol=XAGUSD",
    GOLD: "https://www.tradingview.com/chart/?symbol=XAUUSD",
    XAU: "https://www.tradingview.com/chart/?symbol=XAUUSD",
    BRENT: "https://www.tradingview.com/chart/?symbol=UKOIL",
    BRENTOIL: "https://www.tradingview.com/chart/?symbol=UKOIL",
    OIL: "https://www.tradingview.com/chart/?symbol=USOIL",
    WTI: "https://www.tradingview.com/chart/?symbol=USOIL",
    CRUDE: "https://www.tradingview.com/chart/?symbol=USOIL",
    COPPER: "https://www.tradingview.com/chart/?symbol=COPPER",
    XCU: "https://www.tradingview.com/chart/?symbol=COPPER",
    KUPFER: "https://www.tradingview.com/chart/?symbol=COPPER",
  };

  const getTradingViewLink = (assetName: string): string | null => {
    const raw = assetName.split("/")[0].split("-")[0].trim().toUpperCase();
    return TV_LINKS[raw] ?? null;
  };

  const handleChange = (field: keyof FormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Reset live data when asset changes
    if (field === "assetName") {
      const trimmed = value.trim();
      const manualOnly = trimmed !== "" && isManualOnlyAsset(trimmed);
      setLiveDataRaw(null);
      if (manualOnly) {
        const displayName = trimmed.toUpperCase();
        setLiveDataError(
          `"${displayName}" ist als Perpetual nicht auf Hyperliquid verfügbar. Bitte Preis und Werte manuell eingeben (z.B. von TradingView).`,
        );
        setLiveDataStatus("error");
      } else {
        setLiveDataStatus("idle");
        setLiveDataError("");
      }
      setForm((prev) => ({
        ...prev,
        assetName: value,
        currentPrice: "",
        oiDirection: "",
        fundingLevel: "",
        futureCVD: "",
      }));
    }
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    setForm((prev) => ({ ...prev, rsiTimeframe: tf }));
    setErrors({});
  };

  const fetchLiveData = async () => {
    if (!form.assetName.trim()) return;
    setLiveDataStatus("loading");
    setLiveDataError("");
    try {
      const data = await fetchHyperliquidLiveData(form.assetName);
      setLiveDataRaw(data);
      setForm((prev) => ({
        ...prev,
        currentPrice: formatPrice(data.price),
        oiDirection: data.oiDirection,
        fundingLevel: data.fundingLevel,
        futureCVD: data.futureCVD,
      }));
      setLiveDataStatus("success");
      // Clear price error if it was set
      setErrors((prev) => ({ ...prev, currentPrice: undefined }));
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Hyperliquid API nicht erreichbar. Bitte Werte manuell eingeben.";
      setLiveDataError(msg);
      setLiveDataStatus("error");
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    const assetErr = validateAssetName(form.assetName);
    if (assetErr) newErrors.assetName = assetErr;

    const priceErr = validatePrice(form.currentPrice);
    if (priceErr)
      newErrors.currentPrice =
        "Preis erforderlich — Live-Daten laden oder manuell eingeben.";

    if (!form.emaAlignment) {
      newErrors.emaAlignment = "EMA-Ausrichtung wählen.";
    }

    const rsiErr = validateRSI(form.rsi);
    if (rsiErr) newErrors.rsi = rsiErr;

    if (timeframe === "1m") {
      const atrErr = validateATR(form.atr, true);
      if (atrErr) newErrors.atr = atrErr;
    } else {
      const atrErr = validateATR(form.atr);
      if (atrErr) newErrors.atr = atrErr;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const oiDirectionVal =
      form.oiDirection !== "" ? (form.oiDirection as OIDirection) : undefined;
    const futureCVDVal =
      form.futureCVD !== "" ? (form.futureCVD as CVDSignal) : undefined;
    const fundingLevelVal =
      form.fundingLevel !== ""
        ? (form.fundingLevel as FundingLevel)
        : undefined;
    const liquidationsNearVal =
      form.liquidationsNear !== ""
        ? (form.liquidationsNear as LiquidationsNear)
        : undefined;

    let evalResult: EntryEvaluationResult;

    if (timeframe === "1m") {
      evalResult = evaluateEntryConditions({
        timeframe: "1m",
        assetName: form.assetName.trim(),
        currentPrice: Number.parseFloat(form.currentPrice),
        emaAlignment: form.emaAlignment as EMAAlignment,
        rsi: Number.parseFloat(form.rsi),
        atr: form.atr.trim() !== "" ? Number.parseFloat(form.atr) : undefined,
        tradeDirection: form.tradeDirection,
        rsiTimeframe: form.rsiTimeframe,
        oiDirection: oiDirectionVal,
        futureCVD: futureCVDVal,
        fundingLevel: fundingLevelVal,
        liquidationsNear: liquidationsNearVal,
      });
    } else {
      evalResult = evaluateEntryConditions({
        timeframe: timeframe,
        assetName: form.assetName.trim(),
        currentPrice: Number.parseFloat(form.currentPrice),
        emaAlignment: form.emaAlignment as EMAAlignment,
        rsi: Number.parseFloat(form.rsi),
        atr: Number.parseFloat(form.atr),
        macdDirection: form.macdDirection,
        tradeDirection: form.tradeDirection,
        rsiTimeframe: form.rsiTimeframe,
        oiDirection: oiDirectionVal,
        futureCVD: futureCVDVal,
        fundingLevel: fundingLevelVal,
        liquidationsNear: liquidationsNearVal,
      });
    }

    setSubmittedTimeframe(timeframe);
    setResult(evalResult);

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const handleReset = () => {
    setTimeframe("1m");
    setForm(defaultValues);
    setErrors({});
    setResult(null);
    setLiveDataStatus("idle");
    setLiveDataRaw(null);
    setLiveDataError("");
  };

  const rsiThresholdHint =
    form.rsiTimeframe === "1m"
      ? "Grenzwert: < 75 Long / > 25 Short"
      : form.rsiTimeframe === "15m"
        ? "Grenzwert: < 65 Long / > 35 Short"
        : "Grenzwert: < 60 Long / > 40 Short";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Trade Entry Checker
          </h2>
        </div>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Live-Daten direkt von Hyperliquid — nur Chart-Daten und Kiyotaka
          manuell ablesen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── SECTION 1: Basis ── */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                1
              </span>
              <CardTitle className="text-sm font-semibold">Basis</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            {/* Asset Name */}
            <div className="space-y-1.5">
              <Label htmlFor="assetName" className="text-sm font-medium">
                Asset
              </Label>
              <Input
                id="assetName"
                data-ocid="checker.assetName.input"
                placeholder="z.B. BTC, SILVER, BRENTOIL, ETH"
                value={form.assetName}
                onChange={(e) => handleChange("assetName", e.target.value)}
                className={errors.assetName ? "border-red-500" : ""}
              />
              {errors.assetName && (
                <p
                  className="text-xs text-red-400"
                  data-ocid="checker.assetName.error_state"
                >
                  {errors.assetName}
                </p>
              )}
            </div>

            {/* Direction + Timeframe row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Richtung</Label>
                <RadioGroup
                  value={form.tradeDirection}
                  onValueChange={(v) =>
                    handleChange("tradeDirection", v as TradeDirection)
                  }
                  className="flex gap-4 pt-1"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem
                      value="Long"
                      id="dir-long"
                      data-ocid="checker.long.radio"
                    />
                    <Label
                      htmlFor="dir-long"
                      className="text-sm font-semibold text-emerald-400 cursor-pointer"
                    >
                      ▲ Long
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem
                      value="Short"
                      id="dir-short"
                      data-ocid="checker.short.radio"
                    />
                    <Label
                      htmlFor="dir-short"
                      className="text-sm font-semibold text-red-400 cursor-pointer"
                    >
                      ▼ Short
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Timeframe</Label>
                <div className="flex gap-1.5">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      type="button"
                      data-ocid="checker.timeframe.tab"
                      onClick={() => handleTimeframeChange(tf.value)}
                      className={`
                        flex-1 py-1.5 px-2 rounded text-xs font-mono font-semibold border transition-all
                        ${
                          timeframe === tf.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        }
                      `}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION 2: Live-Daten (Hyperliquid API) ── */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <CardTitle className="text-sm font-semibold">
                  Live-Daten
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 text-muted-foreground"
                >
                  Hyperliquid API
                </Badge>
              </div>
              {liveDataStatus === "success" && (
                <div className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Aktuell</span>
                </div>
              )}
              {liveDataStatus === "error" && (
                <div className="flex items-center gap-1 text-xs text-red-400">
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>Manuell</span>
                </div>
              )}
            </div>
            <CardDescription className="text-xs pl-7">
              Preis, OI, Funding und CVD werden automatisch geladen.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3">
            {/* Idle state */}
            {liveDataStatus === "idle" && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchLiveData}
                  disabled={!form.assetName.trim()}
                  className="gap-2 w-full sm:w-auto"
                  data-ocid="checker.live_data.button"
                >
                  <Wifi className="h-4 w-4" />
                  Lade Live-Daten
                </Button>
                {!form.assetName.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Zuerst Asset-Name eingeben (Abschnitt 1).
                  </p>
                )}
              </div>
            )}

            {/* Loading state */}
            {liveDataStatus === "loading" && (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground"
                data-ocid="checker.live_data.loading_state"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Lade Daten für{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {form.assetName}
                  </span>
                  ...
                </span>
              </div>
            )}

            {/* Success state */}
            {liveDataStatus === "success" && liveDataRaw && (
              <div
                className="space-y-3"
                data-ocid="checker.live_data.success_state"
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {/* Price */}
                  <div className="bg-muted/40 rounded-lg p-2.5 border border-border/40">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Preis
                    </p>
                    <p className="text-sm font-mono font-bold text-foreground">
                      {formatPrice(liveDataRaw.price)}
                    </p>
                  </div>
                  {/* OI */}
                  <div className="bg-muted/40 rounded-lg p-2.5 border border-border/40">
                    <p className="text-xs text-muted-foreground mb-0.5">OI</p>
                    <p
                      className={`text-sm font-semibold ${
                        OI_LABELS[liveDataRaw.oiDirection]?.color
                      }`}
                    >
                      {OI_LABELS[liveDataRaw.oiDirection]?.label}
                    </p>
                  </div>
                  {/* Funding */}
                  <div className="bg-muted/40 rounded-lg p-2.5 border border-border/40">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Funding
                    </p>
                    <p
                      className={`text-xs font-semibold ${
                        FUNDING_LABELS[liveDataRaw.fundingLevel]?.color
                      }`}
                    >
                      {formatFundingRate(liveDataRaw.rawFunding)}
                    </p>
                    <p
                      className={`text-xs ${
                        FUNDING_LABELS[liveDataRaw.fundingLevel]?.color
                      }`}
                    >
                      {FUNDING_LABELS[liveDataRaw.fundingLevel]?.label}
                    </p>
                  </div>
                  {/* CVD */}
                  <div className="bg-muted/40 rounded-lg p-2.5 border border-border/40">
                    <p className="text-xs text-muted-foreground mb-0.5">CVD</p>
                    <p
                      className={`text-sm font-semibold ${
                        CVD_LABELS[liveDataRaw.futureCVD]?.color
                      }`}
                    >
                      {CVD_LABELS[liveDataRaw.futureCVD]?.label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Quelle: Hyperliquid API — zum Aktualisieren erneut laden
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={fetchLiveData}
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    data-ocid="checker.live_data_refresh.button"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Aktualisieren
                  </Button>
                </div>
              </div>
            )}

            {/* Error state */}
            {liveDataStatus === "error" && (
              <div
                className="space-y-3"
                data-ocid="checker.live_data.error_state"
              >
                <Alert className="border-amber-500/30 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-xs text-amber-300 space-y-2">
                    <p>{liveDataError}</p>
                    {getTradingViewLink(form.assetName) && (
                      <a
                        href={getTradingViewLink(form.assetName)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        TradingView Chart öffnen
                      </a>
                    )}
                  </AlertDescription>
                </Alert>

                <p className="text-xs font-medium text-muted-foreground">
                  Bitte Werte manuell eingeben:
                </p>

                {/* Manual fallback fields */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* Manual price */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="currentPrice"
                      className="text-xs font-medium"
                    >
                      Aktueller Preis
                    </Label>
                    <Input
                      id="currentPrice"
                      data-ocid="checker.currentPrice.input"
                      type="number"
                      step="any"
                      placeholder="z.B. 89.10"
                      value={form.currentPrice}
                      onChange={(e) =>
                        handleChange("currentPrice", e.target.value)
                      }
                      className={`h-8 text-sm ${
                        errors.currentPrice ? "border-red-500" : ""
                      }`}
                    />
                    {errors.currentPrice && (
                      <p
                        className="text-xs text-red-400"
                        data-ocid="checker.currentPrice.error_state"
                      >
                        {errors.currentPrice}
                      </p>
                    )}
                  </div>

                  {/* Manual OI */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">OI-Richtung</Label>
                    <Select
                      value={form.oiDirection}
                      onValueChange={(v) => handleChange("oiDirection", v)}
                    >
                      <SelectTrigger
                        className="h-8 text-xs"
                        data-ocid="checker.oiDirection.select"
                      >
                        <SelectValue placeholder="Wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rising">📈 OI steigt</SelectItem>
                        <SelectItem value="neutral">➡ OI neutral</SelectItem>
                        <SelectItem value="falling">📉 OI fällt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Manual Funding */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Funding Rate</Label>
                    <Select
                      value={form.fundingLevel}
                      onValueChange={(v) => handleChange("fundingLevel", v)}
                    >
                      <SelectTrigger
                        className="h-8 text-xs"
                        data-ocid="checker.fundingLevel.select"
                      >
                        <SelectValue placeholder="Wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strongPositive">
                          🔴 Stark positiv
                        </SelectItem>
                        <SelectItem value="neutral">⚪ Neutral</SelectItem>
                        <SelectItem value="strongNegative">
                          🟢 Stark negativ
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Manual CVD */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Futures CVD</Label>
                    <Select
                      value={form.futureCVD}
                      onValueChange={(v) => handleChange("futureCVD", v)}
                    >
                      <SelectTrigger
                        className="h-8 text-xs"
                        data-ocid="checker.futureCVD.select"
                      >
                        <SelectValue placeholder="Wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bullish">🟢 Bullish</SelectItem>
                        <SelectItem value="neutral">⚪ Neutral</SelectItem>
                        <SelectItem value="bearish">🔴 Bearish</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchLiveData}
                  className="gap-1.5 text-xs"
                  data-ocid="checker.live_data_retry.button"
                >
                  <RefreshCw className="h-3 w-3" />
                  Erneut versuchen
                </Button>
              </div>
            )}

            {/* Show price error even when not in error state */}
            {liveDataStatus === "success" && errors.currentPrice && (
              <p
                className="text-xs text-red-400"
                data-ocid="checker.currentPrice.error_state"
              >
                {errors.currentPrice}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── SECTION 3: Chart-Daten ── */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                3
              </span>
              <CardTitle className="text-sm font-semibold">
                Chart-Daten
              </CardTitle>
            </div>
            <CardDescription className="text-xs pl-7">
              📊 Im Hyperliquid Chart ablesen ({timeframe}-Zeitrahmen)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            {/* EMA Alignment Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                EMA Ausrichtung
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  ({timeframe === "1m" ? "EMA9 / EMA21" : "EMA20 / 50 / 200"})
                </span>
              </Label>
              <Select
                value={form.emaAlignment}
                onValueChange={(v) => handleChange("emaAlignment", v)}
              >
                <SelectTrigger
                  data-ocid="checker.emaAlignment.select"
                  className={errors.emaAlignment ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="EMA-Ausrichtung wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {timeframe === "1m" ? (
                    <>
                      <SelectItem value="bullish">
                        📈 EMA9 &gt; EMA21 (Bullish)
                      </SelectItem>
                      <SelectItem value="bearish">
                        📉 EMA9 &lt; EMA21 (Bearish)
                      </SelectItem>
                      <SelectItem value="mixed">↔ Gekreuzt / Unklar</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="bullish">
                        📈 EMA20 &gt; EMA50 &gt; EMA200 (Bullish)
                      </SelectItem>
                      <SelectItem value="bearish">
                        📉 EMA20 &lt; EMA50 &lt; EMA200 (Bearish)
                      </SelectItem>
                      <SelectItem value="mixed">↔ Gemischt</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {errors.emaAlignment && (
                <p
                  className="text-xs text-red-400"
                  data-ocid="checker.emaAlignment.error_state"
                >
                  {errors.emaAlignment}
                </p>
              )}
            </div>

            {/* RSI + ATR row */}
            <div
              className={`grid gap-4 ${
                timeframe === "1m" ? "grid-cols-2" : "grid-cols-2"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rsi" className="text-sm font-medium">
                    RSI (0–100)
                  </Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    [{form.rsiTimeframe}]
                  </span>
                </div>
                <Input
                  id="rsi"
                  data-ocid="checker.rsi.input"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  placeholder="z.B. 52"
                  value={form.rsi}
                  onChange={(e) => handleChange("rsi", e.target.value)}
                  className={errors.rsi ? "border-red-500" : ""}
                />
                {errors.rsi ? (
                  <p
                    className="text-xs text-red-400"
                    data-ocid="checker.rsi.error_state"
                  >
                    {errors.rsi}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {rsiThresholdHint}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="atr" className="text-sm font-medium">
                  ATR{timeframe === "1m" ? " (optional)" : ""}
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    [{timeframe}]
                  </span>
                </Label>
                <Input
                  id="atr"
                  data-ocid="checker.atr.input"
                  type="number"
                  step="any"
                  placeholder="z.B. 0.134"
                  value={form.atr}
                  onChange={(e) => handleChange("atr", e.target.value)}
                  className={errors.atr ? "border-red-500" : ""}
                />
                {errors.atr ? (
                  <p className="text-xs text-red-400">{errors.atr}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {timeframe === "1m"
                      ? "Optional auf 1m"
                      : "Für SL/TP-Berechnung"}
                  </p>
                )}
              </div>
            </div>

            {/* MACD — only for 15m/1h */}
            {timeframe !== "1m" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">MACD Richtung</Label>
                <Select
                  value={form.macdDirection}
                  onValueChange={(v) =>
                    handleChange("macdDirection", v as MACDDirection)
                  }
                >
                  <SelectTrigger data-ocid="checker.macd.select">
                    <SelectValue placeholder="MACD Richtung wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bullish">📈 Bullish</SelectItem>
                    <SelectItem value="Neutral">➡ Neutral</SelectItem>
                    <SelectItem value="Bearish">📉 Bearish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── SECTION 4: Kiyotaka ── */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                  4
                </span>
                <CardTitle className="text-sm font-semibold">
                  Liquidations-Cluster
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 text-muted-foreground"
                >
                  Kiyotaka
                </Badge>
              </div>
              <a
                href="https://kiyotaka.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                data-ocid="checker.kiyotaka.link"
              >
                <ExternalLink className="h-3 w-3" />
                Kiyotaka öffnen
              </a>
            </div>
            <CardDescription className="text-xs pl-7">
              Kiyotaka → Liquidation Heatmap prüfen und Cluster-Position
              angeben.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <Select
              value={form.liquidationsNear}
              onValueChange={(v) => handleChange("liquidationsNear", v)}
            >
              <SelectTrigger data-ocid="checker.liquidationsNear.select">
                <SelectValue placeholder="Liquidations-Cluster wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Keine Cluster erkennbar</SelectItem>
                <SelectItem value="longsNear">
                  ⚡ Long-Liquidationen nahe (Cluster unten)
                </SelectItem>
                <SelectItem value="shortsNear">
                  ⚡ Short-Liquidationen nahe (Cluster oben)
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* ── Buttons ── */}
        <div className="flex gap-3">
          <Button
            type="submit"
            className="flex-1 gap-2"
            data-ocid="checker.submit_button"
          >
            <Search className="h-4 w-4" />
            Analyse starten
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="gap-2"
            data-ocid="checker.reset_button"
          >
            <RotateCcw className="h-4 w-4" />
            Zurücksetzen
          </Button>
        </div>
      </form>

      {/* Results */}
      {result && (
        <div ref={resultsRef}>
          <EntryChecklistResults
            result={result}
            timeframe={submittedTimeframe}
          />
        </div>
      )}
    </div>
  );
}
