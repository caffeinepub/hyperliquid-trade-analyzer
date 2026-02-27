import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, RotateCcw, Search, Info } from 'lucide-react';
import EntryChecklistResults from './EntryChecklistResults';
import {
  evaluateEntryConditions,
  validatePrice,
  validateRSI,
  validateATR,
  validateEMA,
  validateAssetName,
  type EntryEvaluationResult,
  type MACDDirection,
  type TradeDirection,
  type Timeframe,
} from '@/lib/tradeEntryRules';

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
  assetName: '',
  currentPrice: '',
  ema9: '',
  ema21: '',
  ema20: '',
  ema50: '',
  ema200: '',
  rsi: '',
  atr: '',
  macdDirection: 'Neutral',
  tradeDirection: 'Long',
};

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
];

export default function TradeEntryChecker() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [form, setForm] = useState<FormValues>(defaultValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<EntryEvaluationResult | null>(null);
  const [submittedTimeframe, setSubmittedTimeframe] = useState<Timeframe>('1m');
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleChange = (field: keyof FormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    // Clear errors when switching timeframe, but preserve entered values
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    const assetErr = validateAssetName(form.assetName);
    if (assetErr) newErrors.assetName = assetErr;

    const priceErr = validatePrice(form.currentPrice);
    if (priceErr) newErrors.currentPrice = priceErr;

    if (timeframe === '1m') {
      const ema9Err = validateEMA(form.ema9, 'EMA9');
      if (ema9Err) newErrors.ema9 = ema9Err;

      const ema21Err = validateEMA(form.ema21, 'EMA21');
      if (ema21Err) newErrors.ema21 = ema21Err;

      // ATR is optional on 1m
      const atrErr = validateATR(form.atr, true);
      if (atrErr) newErrors.atr = atrErr;
    } else {
      const ema20Err = validateEMA(form.ema20, 'EMA20');
      if (ema20Err) newErrors.ema20 = ema20Err;

      const ema50Err = validateEMA(form.ema50, 'EMA50');
      if (ema50Err) newErrors.ema50 = ema50Err;

      const ema200Err = validateEMA(form.ema200, 'EMA200');
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

    let evalResult: EntryEvaluationResult;

    if (timeframe === '1m') {
      evalResult = evaluateEntryConditions({
        timeframe: '1m',
        assetName: form.assetName.trim(),
        currentPrice: parseFloat(form.currentPrice),
        ema9: parseFloat(form.ema9),
        ema21: parseFloat(form.ema21),
        rsi: parseFloat(form.rsi),
        atr: form.atr.trim() !== '' ? parseFloat(form.atr) : undefined,
        tradeDirection: form.tradeDirection,
      });
    } else {
      evalResult = evaluateEntryConditions({
        timeframe: timeframe,
        assetName: form.assetName.trim(),
        currentPrice: parseFloat(form.currentPrice),
        ema20: parseFloat(form.ema20),
        ema50: parseFloat(form.ema50),
        ema200: parseFloat(form.ema200),
        rsi: parseFloat(form.rsi),
        atr: parseFloat(form.atr),
        macdDirection: form.macdDirection,
        tradeDirection: form.tradeDirection,
      });
    }

    setSubmittedTimeframe(timeframe);
    setResult(evalResult);

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleReset = () => {
    setTimeframe('1m');
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
          <h2 className="text-2xl font-bold text-foreground">Trade Entry Checker</h2>
        </div>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Enter your current market indicators and the app will evaluate whether the setup is ready
          for a Long or Short entry based on EMA alignment, RSI, ATR, and MACD.
        </p>
      </div>

      {/* Form Card */}
      <Card className="border border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Market Parameters</CardTitle>
          <CardDescription className="text-xs">
            All values should be taken from your current chart (e.g., Hyperliquid, TradingView).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Timeframe Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Timeframe</Label>
              <div className="flex gap-2">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    type="button"
                    onClick={() => handleTimeframeChange(tf.value)}
                    className={`
                      flex-1 py-2 px-4 rounded-md text-sm font-semibold font-mono border transition-all duration-150
                      ${
                        timeframe === tf.value
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                      }
                    `}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              {timeframe === '1m' && (
                <p className="text-xs text-muted-foreground">
                  1m uses EMA9/EMA21 for fast execution timing. MACD is omitted (too noisy on 1m).
                </p>
              )}
              {timeframe === '15m' && (
                <p className="text-xs text-muted-foreground">
                  15m uses EMA20/EMA50/EMA200 for trend confirmation with MACD and ATR.
                </p>
              )}
              {timeframe === '1h' && (
                <p className="text-xs text-muted-foreground">
                  1h uses EMA20/EMA50/EMA200 for higher-timeframe trend analysis with MACD and ATR.
                </p>
              )}
            </div>

            {/* Trade Direction */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Trade Direction</Label>
              <RadioGroup
                value={form.tradeDirection}
                onValueChange={(v) => handleChange('tradeDirection', v as TradeDirection)}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Long" id="dir-long" />
                  <Label
                    htmlFor="dir-long"
                    className="text-sm font-medium text-emerald-400 cursor-pointer"
                  >
                    ▲ Long
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Short" id="dir-short" />
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
                placeholder="e.g. BTC/USDC, Silver/USDC, Gold/USDC"
                value={form.assetName}
                onChange={(e) => handleChange('assetName', e.target.value)}
                className={errors.assetName ? 'border-red-500' : ''}
              />
              {errors.assetName && (
                <p className="text-xs text-red-400">{errors.assetName}</p>
              )}
            </div>

            {/* Price Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPrice" className="text-sm font-medium">
                  Current Price
                </Label>
                <Input
                  id="currentPrice"
                  type="number"
                  step="any"
                  placeholder="e.g. 89.10"
                  value={form.currentPrice}
                  onChange={(e) => handleChange('currentPrice', e.target.value)}
                  className={errors.currentPrice ? 'border-red-500' : ''}
                />
                {errors.currentPrice && (
                  <p className="text-xs text-red-400">{errors.currentPrice}</p>
                )}
              </div>

              {/* ATR field — optional on 1m, required on 15m/1h */}
              <div className="space-y-1.5">
                <Label htmlFor="atr" className="text-sm font-medium">
                  ATR{timeframe === '1m' ? ' (optional)' : ''}
                </Label>
                <Input
                  id="atr"
                  type="number"
                  step="any"
                  placeholder="e.g. 0.134"
                  value={form.atr}
                  onChange={(e) => handleChange('atr', e.target.value)}
                  className={errors.atr ? 'border-red-500' : ''}
                />
                {errors.atr && <p className="text-xs text-red-400">{errors.atr}</p>}
                {timeframe === '1m' && !errors.atr && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    On 1m charts, ATR is only useful as a market activity indicator, not for SL/TP. Leave blank if not available.
                  </p>
                )}
              </div>
            </div>

            {/* EMA Fields — conditional on timeframe */}
            {timeframe === '1m' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ema9" className="text-sm font-medium">
                    EMA 9
                  </Label>
                  <Input
                    id="ema9"
                    type="number"
                    step="any"
                    placeholder="e.g. 88.95"
                    value={form.ema9}
                    onChange={(e) => handleChange('ema9', e.target.value)}
                    className={errors.ema9 ? 'border-red-500' : ''}
                  />
                  {errors.ema9 && <p className="text-xs text-red-400">{errors.ema9}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ema21" className="text-sm font-medium">
                    EMA 21
                  </Label>
                  <Input
                    id="ema21"
                    type="number"
                    step="any"
                    placeholder="e.g. 88.70"
                    value={form.ema21}
                    onChange={(e) => handleChange('ema21', e.target.value)}
                    className={errors.ema21 ? 'border-red-500' : ''}
                  />
                  {errors.ema21 && <p className="text-xs text-red-400">{errors.ema21}</p>}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ema20" className="text-sm font-medium">
                    EMA 20
                  </Label>
                  <Input
                    id="ema20"
                    type="number"
                    step="any"
                    placeholder="e.g. 88.90"
                    value={form.ema20}
                    onChange={(e) => handleChange('ema20', e.target.value)}
                    className={errors.ema20 ? 'border-red-500' : ''}
                  />
                  {errors.ema20 && <p className="text-xs text-red-400">{errors.ema20}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ema50" className="text-sm font-medium">
                    EMA 50
                  </Label>
                  <Input
                    id="ema50"
                    type="number"
                    step="any"
                    placeholder="e.g. 87.50"
                    value={form.ema50}
                    onChange={(e) => handleChange('ema50', e.target.value)}
                    className={errors.ema50 ? 'border-red-500' : ''}
                  />
                  {errors.ema50 && <p className="text-xs text-red-400">{errors.ema50}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ema200" className="text-sm font-medium">
                    EMA 200
                  </Label>
                  <Input
                    id="ema200"
                    type="number"
                    step="any"
                    placeholder="e.g. 85.00"
                    value={form.ema200}
                    onChange={(e) => handleChange('ema200', e.target.value)}
                    className={errors.ema200 ? 'border-red-500' : ''}
                  />
                  {errors.ema200 && (
                    <p className="text-xs text-red-400">{errors.ema200}</p>
                  )}
                </div>
              </div>
            )}

            {/* RSI + MACD Row */}
            <div className={`grid gap-4 ${timeframe === '1m' ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div className="space-y-1.5">
                <Label htmlFor="rsi" className="text-sm font-medium">
                  RSI (0–100)
                </Label>
                <Input
                  id="rsi"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  placeholder="e.g. 52.4"
                  value={form.rsi}
                  onChange={(e) => handleChange('rsi', e.target.value)}
                  className={errors.rsi ? 'border-red-500' : ''}
                />
                {errors.rsi && <p className="text-xs text-red-400">{errors.rsi}</p>}
                {timeframe === '1m' && !errors.rsi && (
                  <p className="text-xs text-muted-foreground">
                    On 1m: RSI &lt; 75 for Long, RSI &gt; 25 for Short.
                  </p>
                )}
              </div>

              {/* MACD — hidden on 1m */}
              {timeframe !== '1m' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="macd" className="text-sm font-medium">
                    MACD Direction
                  </Label>
                  <Select
                    value={form.macdDirection}
                    onValueChange={(v) => handleChange('macdDirection', v as MACDDirection)}
                  >
                    <SelectTrigger id="macd">
                      <SelectValue placeholder="Select MACD direction" />
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
                    MACD is not recommended for 1m charts due to excessive noise. It is omitted from the 1m evaluation.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 gap-2">
                <Search className="h-4 w-4" />
                Check Entry
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="gap-2"
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
          <EntryChecklistResults result={result} timeframe={submittedTimeframe} />
        </div>
      )}
    </div>
  );
}
