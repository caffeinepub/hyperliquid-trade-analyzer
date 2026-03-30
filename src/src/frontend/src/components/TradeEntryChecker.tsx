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
  type CVDSignal,
  type EntryEvaluationResult,
  type FundingLevel,
  type LiquidationsNear,
  type MACDDirection,
  type OIDirection,
  type OrderbookImbalance,
  type RSITimeframe,
  type Timeframe,
  type TradeDirection,
  type VolumeLevel,
  evaluateEntryConditions,
  validateATR,
  validateAssetName,
  validateEMA,
  validatePrice,
  validateRSI,
} from "@/lib/tradeEntryRules";
import { BookOpen, Info, RotateCcw, Search, TrendingUp } from "lucide-react";
import { useRef, useState } from "react";
import EntryChecklistResults from "./EntryChecklistResults";

interface FormValues {
  assetName: string;
  currentPrice: string;
  // 1m fields
  ema9: string;
  ema21: string;
  // 15m/1h fields
  ema20: string;
  ema50: string;
  ema200: string;
  rsi: string;
  atr: string;
  macdDirection: MACDDirection;
  tradeDirection: TradeDirection;
  rsiTimeframe: RSITimeframe;
  bidAskSpread: string;
  orderbookImbalance: OrderbookImbalance | "";
  volumeLevel: VolumeLevel | "";
  oiDirection: OIDirection | "";
  futureCVD: CVDSignal | "";
  spotCVD: CVDSignal | "";
  fundingLevel: FundingLevel | "";
  liquidationsNear: LiquidationsNear | "";
}

interface FormErrors {
  assetName?: string;
  currentPrice?: string;
  ema9?: string;
  ema21?: string;
  ema20?: string;
  ema50?: string;
  ema200?: string;
  rsi?: string;
  atr?: string;
}

const defaultValues: FormValues = {
  assetName: "",
  currentPrice: "",
  ema9: "",
  ema21: "",
  ema20: "",
  ema50: "",
  ema200: "",
  rsi: "",
  atr: "",
  macdDirection: "Neutral",
  tradeDirection: "Long",
  rsiTimeframe: "1m",
  bidAskSpread: "",
  orderbookImbalance: "",
  volumeLevel: "",
  oiDirection: "",
  futureCVD: "",
  spotCVD: "",
  fundingLevel: "",
  liquidationsNear: "",
};

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
];

const RSI_TIMEFRAMES: { value: RSITimeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
];

export default function TradeEntryChecker() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [form, setForm] = useState<FormValues>(defaultValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<EntryEvaluationResult | null>(null);
  const [submittedTimeframe, setSubmittedTimeframe] = useState<Timeframe>("1m");
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleChange = (field: keyof FormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    // Sync RSI timeframe to global timeframe by default
    setForm((prev) => ({ ...prev, rsiTimeframe: tf }));
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    const assetErr = validateAssetName(form.assetName);
    if (assetErr) newErrors.assetName = assetErr;

    const priceErr = validatePrice(form.currentPrice);
    if (priceErr) newErrors.currentPrice = priceErr;

    if (timeframe === "1m") {
      const ema9Err = validateEMA(form.ema9, "EMA9");
      if (ema9Err) newErrors.ema9 = ema9Err;

      const ema21Err = validateEMA(form.ema21, "EMA21");
      if (ema21Err) newErrors.ema21 = ema21Err;

      // ATR is optional on 1m
      const atrErr = validateATR(form.atr, true);
      if (atrErr) newErrors.atr = atrErr;
    } else {
      const ema20Err = validateEMA(form.ema20, "EMA20");
      if (ema20Err) newErrors.ema20 = ema20Err;

      const ema50Err = validateEMA(form.ema50, "EMA50");
      if (ema50Err) newErrors.ema50 = ema50Err;

      const ema200Err = validateEMA(form.ema200, "EMA200");
      if (ema200Err) newErrors.ema200 = ema200Err;

      const atrErr = validateATR(form.atr);
      if (atrErr) newErrors.atr = atrErr;
    }

    const rsiErr = validateRSI(form.rsi);
    if (rsiErr) newErrors.rsi = rsiErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const bidAskSpreadVal =
      form.bidAskSpread.trim() !== ""
        ? Number.parseFloat(form.bidAskSpread)
        : undefined;
    const orderbookImbalanceVal =
      form.orderbookImbalance !== ""
        ? (form.orderbookImbalance as OrderbookImbalance)
        : undefined;
    const volumeLevelVal =
      form.volumeLevel !== "" ? (form.volumeLevel as VolumeLevel) : undefined;
    const oiDirectionVal =
      form.oiDirection !== "" ? (form.oiDirection as OIDirection) : undefined;
    const futureCVDVal =
      form.futureCVD !== "" ? (form.futureCVD as CVDSignal) : undefined;
    const spotCVDVal =
      form.spotCVD !== "" ? (form.spotCVD as CVDSignal) : undefined;
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
        ema9: Number.parseFloat(form.ema9),
        ema21: Number.parseFloat(form.ema21),
        rsi: Number.parseFloat(form.rsi),
        atr: form.atr.trim() !== "" ? Number.parseFloat(form.atr) : undefined,
        tradeDirection: form.tradeDirection,
        rsiTimeframe: form.rsiTimeframe,
        bidAskSpread: bidAskSpreadVal,
        orderbookImbalance: orderbookImbalanceVal,
        volumeLevel: volumeLevelVal,
        oiDirection: oiDirectionVal,
        futureCVD: futureCVDVal,
        spotCVD: spotCVDVal,
        fundingLevel: fundingLevelVal,
        liquidationsNear: liquidationsNearVal,
      });
    } else {
      evalResult = evaluateEntryConditions({
        timeframe: timeframe,
        assetName: form.assetName.trim(),
        currentPrice: Number.parseFloat(form.currentPrice),
        ema20: Number.parseFloat(form.ema20),
        ema50: Number.parseFloat(form.ema50),
        ema200: Number.parseFloat(form.ema200),
        rsi: Number.parseFloat(form.rsi),
        atr: Number.parseFloat(form.atr),
        macdDirection: form.macdDirection,
        tradeDirection: form.tradeDirection,
        rsiTimeframe: form.rsiTimeframe,
        bidAskSpread: bidAskSpreadVal,
        orderbookImbalance: orderbookImbalanceVal,
        volumeLevel: volumeLevelVal,
        oiDirection: oiDirectionVal,
        futureCVD: futureCVDVal,
        spotCVD: spotCVDVal,
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
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Trade Entry Checker
          </h2>
        </div>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Gib deine aktuellen Marktindikatoren ein und die App bewertet, ob das
          Setup für einen Long- oder Short-Einstieg bereit ist.
        </p>
      </div>

      {/* Form Card */}
      <Card className="border border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">
            Markt-Parameter
          </CardTitle>
          <CardDescription className="text-xs">
            Alle Werte vom aktuellen Chart ablesen (z.B. Hyperliquid,
            TradingView).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Timeframe Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Timeframe (Chart)</Label>
              <div className="flex gap-2">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    type="button"
                    data-ocid="checker.timeframe.tab"
                    onClick={() => handleTimeframeChange(tf.value)}
                    className={`
                      flex-1 py-2 px-4 rounded-md text-sm font-semibold font-mono border transition-all duration-150
                      ${
                        timeframe === tf.value
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      }
                    `}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              {timeframe === "1m" && (
                <p className="text-xs text-muted-foreground">
                  1m nutzt EMA9/EMA21 für schnelles Execution-Timing. MACD
                  entfällt (zu viel Rauschen).
                </p>
              )}
              {timeframe === "15m" && (
                <p className="text-xs text-muted-foreground">
                  15m nutzt EMA20/EMA50/EMA200 für Trendbestätigung mit MACD und
                  ATR.
                </p>
              )}
              {timeframe === "1h" && (
                <p className="text-xs text-muted-foreground">
                  1h nutzt EMA20/EMA50/EMA200 für übergeordnete Trendanalyse mit
                  MACD und ATR.
                </p>
              )}
            </div>

            {/* Trade Direction */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Trade Direction</Label>
              <RadioGroup
                value={form.tradeDirection}
                onValueChange={(v) =>
                  handleChange("tradeDirection", v as TradeDirection)
                }
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="Long"
                    id="dir-long"
                    data-ocid="checker.long.radio"
                  />
                  <Label
                    htmlFor="dir-long"
                    className="text-sm font-medium text-emerald-400 cursor-pointer"
                  >
                    ▲ Long
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="Short"
                    id="dir-short"
                    data-ocid="checker.short.radio"
                  />
                  <Label
                    htmlFor="dir-short"
                    className="text-sm font-medium text-red-400 cursor-pointer"
                  >
                    ▼ Short
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Asset Name */}
            <div className="space-y-1.5">
              <Label htmlFor="assetName" className="text-sm font-medium">
                Asset Name
              </Label>
              <Input
                id="assetName"
                data-ocid="checker.assetName.input"
                placeholder="z.B. BTC/USDC, Silver/USDC, BrentOil/USDC"
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

            {/* Price Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPrice" className="text-sm font-medium">
                  Aktueller Preis
                </Label>
                <Input
                  id="currentPrice"
                  data-ocid="checker.currentPrice.input"
                  type="number"
                  step="any"
                  placeholder="z.B. 89.10"
                  value={form.currentPrice}
                  onChange={(e) => handleChange("currentPrice", e.target.value)}
                  className={errors.currentPrice ? "border-red-500" : ""}
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

              {/* ATR field — optional on 1m, required on 15m/1h */}
              <div className="space-y-1.5">
                <Label htmlFor="atr" className="text-sm font-medium">
                  ATR{timeframe === "1m" ? " (optional)" : ""}
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
                {errors.atr && (
                  <p className="text-xs text-red-400">{errors.atr}</p>
                )}
                {timeframe === "1m" && !errors.atr && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Im 1m-Chart nur als Aktivitäts-Indikator. Leer lassen wenn
                    nicht verfügbar.
                  </p>
                )}
              </div>
            </div>

            {/* EMA Fields — conditional on timeframe */}
            {timeframe === "1m" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">EMA-Werte</Label>
                  <Badge
                    variant="secondary"
                    className="text-xs font-mono px-1.5 py-0"
                  >
                    Werte vom 1m Chart
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ema9" className="text-sm font-medium">
                      EMA 9
                    </Label>
                    <Input
                      id="ema9"
                      data-ocid="checker.ema9.input"
                      type="number"
                      step="any"
                      placeholder="z.B. 88.95"
                      value={form.ema9}
                      onChange={(e) => handleChange("ema9", e.target.value)}
                      className={errors.ema9 ? "border-red-500" : ""}
                    />
                    {errors.ema9 && (
                      <p className="text-xs text-red-400">{errors.ema9}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ema21" className="text-sm font-medium">
                      EMA 21
                    </Label>
                    <Input
                      id="ema21"
                      data-ocid="checker.ema21.input"
                      type="number"
                      step="any"
                      placeholder="z.B. 88.70"
                      value={form.ema21}
                      onChange={(e) => handleChange("ema21", e.target.value)}
                      className={errors.ema21 ? "border-red-500" : ""}
                    />
                    {errors.ema21 && (
                      <p className="text-xs text-red-400">{errors.ema21}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">EMA-Werte</Label>
                  <Badge
                    variant="secondary"
                    className="text-xs font-mono px-1.5 py-0"
                  >
                    Werte vom {timeframe} Chart
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ema20" className="text-sm font-medium">
                      EMA 20
                    </Label>
                    <Input
                      id="ema20"
                      data-ocid="checker.ema20.input"
                      type="number"
                      step="any"
                      placeholder="z.B. 88.90"
                      value={form.ema20}
                      onChange={(e) => handleChange("ema20", e.target.value)}
                      className={errors.ema20 ? "border-red-500" : ""}
                    />
                    {errors.ema20 && (
                      <p className="text-xs text-red-400">{errors.ema20}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ema50" className="text-sm font-medium">
                      EMA 50
                    </Label>
                    <Input
                      id="ema50"
                      data-ocid="checker.ema50.input"
                      type="number"
                      step="any"
                      placeholder="z.B. 87.50"
                      value={form.ema50}
                      onChange={(e) => handleChange("ema50", e.target.value)}
                      className={errors.ema50 ? "border-red-500" : ""}
                    />
                    {errors.ema50 && (
                      <p className="text-xs text-red-400">{errors.ema50}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ema200" className="text-sm font-medium">
                      EMA 200
                    </Label>
                    <Input
                      id="ema200"
                      data-ocid="checker.ema200.input"
                      type="number"
                      step="any"
                      placeholder="z.B. 85.00"
                      value={form.ema200}
                      onChange={(e) => handleChange("ema200", e.target.value)}
                      className={errors.ema200 ? "border-red-500" : ""}
                    />
                    {errors.ema200 && (
                      <p className="text-xs text-red-400">{errors.ema200}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RSI + RSI Timeframe + MACD Row */}
            <div
              className={`grid gap-4 ${timeframe === "1m" ? "grid-cols-1" : "grid-cols-2"}`}
            >
              <div className="space-y-1.5">
                {/* RSI label row with timeframe toggle */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label htmlFor="rsi" className="text-sm font-medium">
                    RSI (0–100)
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      RSI-Timeframe:
                    </span>
                    <div className="flex gap-1">
                      {RSI_TIMEFRAMES.map((tf) => (
                        <button
                          key={tf.value}
                          type="button"
                          data-ocid="checker.rsiTimeframe.tab"
                          onClick={() => handleChange("rsiTimeframe", tf.value)}
                          className={`
                            px-2 py-0.5 rounded text-xs font-mono font-semibold border transition-all duration-150
                            ${
                              form.rsiTimeframe === tf.value
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
                <Input
                  id="rsi"
                  data-ocid="checker.rsi.input"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  placeholder="z.B. 52.4"
                  value={form.rsi}
                  onChange={(e) => handleChange("rsi", e.target.value)}
                  className={errors.rsi ? "border-red-500" : ""}
                />
                {errors.rsi && (
                  <p
                    className="text-xs text-red-400"
                    data-ocid="checker.rsi.error_state"
                  >
                    {errors.rsi}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {form.rsiTimeframe === "1m" &&
                    "RSI 1m: Long < 75, Short > 25"}
                  {form.rsiTimeframe === "15m" &&
                    "RSI 15m: Long < 65, Short > 35"}
                  {form.rsiTimeframe === "1h" &&
                    "RSI 1h: Long < 60, Short > 40"}
                </p>
              </div>

              {/* MACD — hidden on 1m */}
              {timeframe !== "1m" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="macd" className="text-sm font-medium">
                    MACD Direction
                  </Label>
                  <Select
                    value={form.macdDirection}
                    onValueChange={(v) =>
                      handleChange("macdDirection", v as MACDDirection)
                    }
                  >
                    <SelectTrigger id="macd" data-ocid="checker.macd.select">
                      <SelectValue placeholder="MACD Richtung wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bullish">📈 Bullish</SelectItem>
                      <SelectItem value="Neutral">➡ Neutral</SelectItem>
                      <SelectItem value="Bearish">📉 Bearish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Alert className="border-border/50 bg-muted/30 col-span-1">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <AlertDescription className="text-xs text-muted-foreground">
                    MACD im 1m-Chart nicht empfohlen (zu viel Rauschen).
                    Entfällt bei 1m-Bewertung.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Orderbook & Volume Section */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  Orderbook & Volumen
                </span>
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 text-muted-foreground"
                >
                  optional
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Bid/Ask Spread */}
                <div className="space-y-1.5">
                  <Label htmlFor="bidAskSpread" className="text-sm font-medium">
                    Bid/Ask Spread
                  </Label>
                  <Input
                    id="bidAskSpread"
                    data-ocid="checker.bidAskSpread.input"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="z.B. 0.05"
                    value={form.bidAskSpread}
                    onChange={(e) =>
                      handleChange("bidAskSpread", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Absoluter Spread-Wert
                  </p>
                </div>

                {/* Orderbook Imbalance */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="orderbookImbalance"
                    className="text-sm font-medium"
                  >
                    Orderbook
                  </Label>
                  <Select
                    value={form.orderbookImbalance}
                    onValueChange={(v) => handleChange("orderbookImbalance", v)}
                  >
                    <SelectTrigger
                      id="orderbookImbalance"
                      data-ocid="checker.orderbookImbalance.select"
                    >
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="moreBids">
                        🟢 Mehr Bids (bullish)
                      </SelectItem>
                      <SelectItem value="balanced">⚪ Ausgeglichen</SelectItem>
                      <SelectItem value="moreAsks">
                        🔴 Mehr Asks (bearish)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Volume Level */}
                <div className="space-y-1.5">
                  <Label htmlFor="volumeLevel" className="text-sm font-medium">
                    Volumen
                  </Label>
                  <Select
                    value={form.volumeLevel}
                    onValueChange={(v) => handleChange("volumeLevel", v)}
                  >
                    <SelectTrigger
                      id="volumeLevel"
                      data-ocid="checker.volumeLevel.select"
                    >
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">
                        📈 Über Durchschnitt
                      </SelectItem>
                      <SelectItem value="average">➡ Durchschnitt</SelectItem>
                      <SelectItem value="below">
                        📉 Unter Durchschnitt
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Orderflow Section */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  Orderflow (OI / CVD / Funding)
                </span>
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 text-muted-foreground"
                >
                  optional
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Werte von HyperDash, Kiyotaka oder TradingView ablesen
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* OI Direction */}
                <div className="space-y-1.5">
                  <Label htmlFor="oiDirection" className="text-sm font-medium">
                    OI-Richtung
                  </Label>
                  <Select
                    value={form.oiDirection}
                    onValueChange={(v) => handleChange("oiDirection", v)}
                  >
                    <SelectTrigger
                      id="oiDirection"
                      data-ocid="checker.oiDirection.select"
                    >
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rising">
                        📈 OI steigt (neues Geld)
                      </SelectItem>
                      <SelectItem value="neutral">➡ OI neutral</SelectItem>
                      <SelectItem value="falling">
                        📉 OI fällt (Positionen schließen)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Futures CVD */}
                <div className="space-y-1.5">
                  <Label htmlFor="futureCVD" className="text-sm font-medium">
                    Futures CVD
                  </Label>
                  <Select
                    value={form.futureCVD}
                    onValueChange={(v) => handleChange("futureCVD", v)}
                  >
                    <SelectTrigger
                      id="futureCVD"
                      data-ocid="checker.futureCVD.select"
                    >
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bullish">
                        🟢 Bullish (Longs aggressiv)
                      </SelectItem>
                      <SelectItem value="neutral">⚪ Neutral</SelectItem>
                      <SelectItem value="bearish">
                        🔴 Bearish (Shorts aggressiv)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Spot CVD */}
                <div className="space-y-1.5">
                  <Label htmlFor="spotCVD" className="text-sm font-medium">
                    Spot CVD
                  </Label>
                  <Select
                    value={form.spotCVD}
                    onValueChange={(v) => handleChange("spotCVD", v)}
                  >
                    <SelectTrigger
                      id="spotCVD"
                      data-ocid="checker.spotCVD.select"
                    >
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bullish">
                        🟢 Bullish (echtes Kaufen)
                      </SelectItem>
                      <SelectItem value="neutral">⚪ Neutral/fehlt</SelectItem>
                      <SelectItem value="bearish">
                        🔴 Bearish (echter Verkauf)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Funding Rate */}
                <div className="space-y-1.5">
                  <Label htmlFor="fundingLevel" className="text-sm font-medium">
                    Funding Rate
                  </Label>
                  <Select
                    value={form.fundingLevel}
                    onValueChange={(v) => handleChange("fundingLevel", v)}
                  >
                    <SelectTrigger
                      id="fundingLevel"
                      data-ocid="checker.fundingLevel.select"
                    >
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strongPositive">
                        🔴 Stark positiv (viele Longs)
                      </SelectItem>
                      <SelectItem value="neutral">⚪ Neutral</SelectItem>
                      <SelectItem value="strongNegative">
                        🟢 Stark negativ (viele Shorts)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Liquidations Near */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label
                    htmlFor="liquidationsNear"
                    className="text-sm font-medium"
                  >
                    Liquidationen nahe
                  </Label>
                  <Select
                    value={form.liquidationsNear}
                    onValueChange={(v) => handleChange("liquidationsNear", v)}
                  >
                    <SelectTrigger
                      id="liquidationsNear"
                      data-ocid="checker.liquidationsNear.select"
                    >
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="longsNear">
                        ⚡ Long-Cluster nahe (Bottom?)
                      </SelectItem>
                      <SelectItem value="none">— Keine</SelectItem>
                      <SelectItem value="shortsNear">
                        ⚡ Short-Cluster nahe (Top?)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="flex-1 gap-2"
                data-ocid="checker.submit_button"
              >
                <Search className="h-4 w-4" />
                Entry prüfen
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="gap-2"
                data-ocid="checker.reset_button"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
