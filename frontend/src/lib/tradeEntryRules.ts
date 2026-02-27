export type MACDDirection = 'Bullish' | 'Neutral' | 'Bearish';
export type TradeDirection = 'Long' | 'Short';
export type Verdict = 'go' | 'wait' | 'no-go';
export type Timeframe = '1m' | '15m' | '1h';

// Params for 1m timeframe
export interface TradeEntryParams1m {
  timeframe: '1m';
  assetName: string;
  currentPrice: number;
  ema9: number;
  ema21: number;
  rsi: number;
  atr?: number; // optional on 1m
  tradeDirection: TradeDirection;
}

// Params for 15m/1h timeframe
export interface TradeEntryParams15m1h {
  timeframe: '15m' | '1h';
  assetName: string;
  currentPrice: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  atr: number;
  macdDirection: MACDDirection;
  tradeDirection: TradeDirection;
}

export type TradeEntryParams = TradeEntryParams1m | TradeEntryParams15m1h;

export interface ConditionResult {
  label: string;
  pass: boolean;
  details: string;
  failureExplanation: string | null;
}

export interface EntryEvaluationResult {
  conditionResults: ConditionResult[];
  passedCount: number;
  totalConditions: number;
  verdict: Verdict;
  summaryMessage: string;
  params: TradeEntryParams;
}

// Validation helpers
export function validatePrice(value: string): string | null {
  if (value.trim() === '') return 'This field is required.';
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return 'Must be a positive number.';
  return null;
}

export function validateRSI(value: string): string | null {
  if (value.trim() === '') return 'This field is required.';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Must be a number.';
  if (num < 0 || num > 100) return 'RSI must be between 0 and 100.';
  return null;
}

export function validateATR(value: string, optional = false): string | null {
  if (optional && value.trim() === '') return null;
  if (value.trim() === '') return 'This field is required.';
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return 'ATR must be greater than 0.';
  return null;
}

export function validateEMA(value: string, label: string): string | null {
  if (value.trim() === '') return 'This field is required.';
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return `${label} must be a positive number.`;
  return null;
}

export function validateAssetName(value: string): string | null {
  if (value.trim() === '') return 'This field is required.';
  return null;
}

function computeVerdict(passedCount: number, totalConditions: number): Verdict {
  if (passedCount === totalConditions) return 'go';
  if (passedCount >= Math.ceil(totalConditions / 2)) return 'wait';
  return 'no-go';
}

function buildSummaryMessage(verdict: Verdict, passedCount: number, totalConditions: number, tradeDirection: TradeDirection): string {
  if (verdict === 'go') {
    return `All ${totalConditions} conditions are met. The setup looks clean for a ${tradeDirection} entry.`;
  }
  if (verdict === 'wait') {
    return `${passedCount} of ${totalConditions} conditions met. Some signals are not aligned yet — wait for a better setup.`;
  }
  return `Only ${passedCount} of ${totalConditions} conditions met. The setup is not ready for a ${tradeDirection} entry. Do not enter now.`;
}

// Evaluate for 1m timeframe
function evaluate1m(params: TradeEntryParams1m): EntryEvaluationResult {
  const { currentPrice, ema9, ema21, rsi, atr, tradeDirection } = params;
  const conditions: ConditionResult[] = [];

  if (tradeDirection === 'Long') {
    // Condition 1: EMA9 > EMA21 alignment
    const emaAligned = ema9 > ema21;
    conditions.push({
      label: 'EMA9 > EMA21 (Short-term Bullish)',
      pass: emaAligned,
      details: `EMA9 (${ema9}) > EMA21 (${ema21})`,
      failureExplanation: emaAligned
        ? null
        : `EMA9 (${ema9}) is not above EMA21 (${ema21}). For a 1m Long entry, EMA9 must be above EMA21 to confirm short-term bullish momentum. Wait for EMA9 to cross above EMA21.`,
    });

    // Condition 2: Price proximity to EMA9 (only if ATR provided)
    if (atr !== undefined && atr > 0) {
      const notOverextended = currentPrice <= ema9 + atr;
      conditions.push({
        label: 'Price Not Overextended Above EMA9',
        pass: notOverextended,
        details: `Price (${currentPrice}) ≤ EMA9 + 1×ATR (${(ema9 + atr).toFixed(4)})`,
        failureExplanation: notOverextended
          ? null
          : `Price (${currentPrice}) is overextended above EMA9 by more than 1×ATR (${atr}). Wait for a pullback to EMA9 (${ema9}) before entering Long.`,
      });
    }

    // Condition 3: RSI not overbought (< 75 for 1m)
    const rsiOk = rsi < 75;
    conditions.push({
      label: 'RSI Not Overbought (< 75)',
      pass: rsiOk,
      details: `RSI = ${rsi}`,
      failureExplanation: rsiOk
        ? null
        : `RSI is ${rsi}, which is overbought on the 1m chart (≥75). Wait 1–2 candles for RSI to cool down before entering Long.`,
    });
  } else {
    // SHORT conditions for 1m

    // Condition 1: EMA9 < EMA21 alignment
    const emaAligned = ema9 < ema21;
    conditions.push({
      label: 'EMA9 < EMA21 (Short-term Bearish)',
      pass: emaAligned,
      details: `EMA9 (${ema9}) < EMA21 (${ema21})`,
      failureExplanation: emaAligned
        ? null
        : `EMA9 (${ema9}) is not below EMA21 (${ema21}). For a 1m Short entry, EMA9 must be below EMA21 to confirm short-term bearish momentum. Wait for EMA9 to cross below EMA21.`,
    });

    // Condition 2: Price proximity to EMA9 (only if ATR provided)
    if (atr !== undefined && atr > 0) {
      const notOverextended = currentPrice >= ema9 - atr;
      conditions.push({
        label: 'Price Not Overextended Below EMA9',
        pass: notOverextended,
        details: `Price (${currentPrice}) ≥ EMA9 − 1×ATR (${(ema9 - atr).toFixed(4)})`,
        failureExplanation: notOverextended
          ? null
          : `Price (${currentPrice}) is overextended below EMA9 by more than 1×ATR (${atr}). Wait for a bounce back toward EMA9 (${ema9}) before entering Short.`,
      });
    }

    // Condition 3: RSI not oversold (> 25 for 1m)
    const rsiOk = rsi > 25;
    conditions.push({
      label: 'RSI Not Oversold (> 25)',
      pass: rsiOk,
      details: `RSI = ${rsi}`,
      failureExplanation: rsiOk
        ? null
        : `RSI is ${rsi}, which is oversold on the 1m chart (≤25). Wait 1–2 candles for RSI to recover before entering Short.`,
    });
  }

  const passedCount = conditions.filter((c) => c.pass).length;
  const totalConditions = conditions.length;
  const verdict = computeVerdict(passedCount, totalConditions);
  const summaryMessage = buildSummaryMessage(verdict, passedCount, totalConditions, tradeDirection);

  return { conditionResults: conditions, passedCount, totalConditions, verdict, summaryMessage, params };
}

// Evaluate for 15m/1h timeframe
function evaluate15m1h(params: TradeEntryParams15m1h): EntryEvaluationResult {
  const { currentPrice, ema20, ema50, ema200, rsi, atr, macdDirection, tradeDirection } = params;
  const conditions: ConditionResult[] = [];

  if (tradeDirection === 'Long') {
    // Condition 1: EMA trend alignment (EMA20 > EMA50 > EMA200)
    const emaAligned = ema20 > ema50 && ema50 > ema200;
    conditions.push({
      label: 'EMA Trend Alignment (Bullish)',
      pass: emaAligned,
      details: `EMA20 (${ema20}) > EMA50 (${ema50}) > EMA200 (${ema200})`,
      failureExplanation: emaAligned
        ? null
        : `EMA alignment is not bullish. Currently: EMA20=${ema20}, EMA50=${ema50}, EMA200=${ema200}. For a Long, you need EMA20 > EMA50 > EMA200. Wait until the trend structure aligns.`,
    });

    // Condition 2: Price proximity – not overextended above EMA20
    const notOverextended = currentPrice <= ema20 + atr;
    conditions.push({
      label: 'Price Not Overextended Above EMA20',
      pass: notOverextended,
      details: `Price (${currentPrice}) ≤ EMA20 + 1×ATR (${(ema20 + atr).toFixed(4)})`,
      failureExplanation: notOverextended
        ? null
        : `Price (${currentPrice}) is overextended above EMA20 by more than 1×ATR (${atr}). The ideal entry is a pullback to EMA20 (${ema20}). Wait for price to return closer to EMA20 before entering.`,
    });

    // Condition 3: RSI not overbought (< 65 for 15m/1h)
    const rsiOk = rsi < 65;
    conditions.push({
      label: 'RSI Not Overbought (< 65)',
      pass: rsiOk,
      details: `RSI = ${rsi}`,
      failureExplanation: rsiOk
        ? null
        : `RSI is ${rsi}, which is overbought (≥65). This increases the risk of a reversal. Wait for RSI to pull back below 60 before entering Long.`,
    });

    // Condition 4: MACD direction
    const macdOk = macdDirection === 'Bullish' || macdDirection === 'Neutral';
    conditions.push({
      label: 'MACD Confirms Bullish Momentum',
      pass: macdOk,
      details: `MACD Direction: ${macdDirection}`,
      failureExplanation: macdOk
        ? null
        : `MACD is Bearish, indicating downward momentum. For a Long entry, MACD should be Bullish or at least Neutral. Wait for MACD to turn around before entering.`,
    });
  } else {
    // SHORT conditions for 15m/1h

    // Condition 1: EMA trend alignment (EMA20 < EMA50 < EMA200)
    const emaAligned = ema20 < ema50 && ema50 < ema200;
    conditions.push({
      label: 'EMA Trend Alignment (Bearish)',
      pass: emaAligned,
      details: `EMA20 (${ema20}) < EMA50 (${ema50}) < EMA200 (${ema200})`,
      failureExplanation: emaAligned
        ? null
        : `EMA alignment is not bearish. Currently: EMA20=${ema20}, EMA50=${ema50}, EMA200=${ema200}. For a Short, you need EMA20 < EMA50 < EMA200. Wait until the downtrend structure is confirmed.`,
    });

    // Condition 2: Price proximity – not overextended below EMA20
    const notOverextended = currentPrice >= ema20 - atr;
    conditions.push({
      label: 'Price Not Overextended Below EMA20',
      pass: notOverextended,
      details: `Price (${currentPrice}) ≥ EMA20 − 1×ATR (${(ema20 - atr).toFixed(4)})`,
      failureExplanation: notOverextended
        ? null
        : `Price (${currentPrice}) is overextended below EMA20 by more than 1×ATR (${atr}). The ideal Short entry is a pullback to EMA20 (${ema20}). Wait for price to bounce back toward EMA20 before entering Short.`,
    });

    // Condition 3: RSI not oversold (> 35 for 15m/1h)
    const rsiOk = rsi > 35;
    conditions.push({
      label: 'RSI Not Oversold (> 35)',
      pass: rsiOk,
      details: `RSI = ${rsi}`,
      failureExplanation: rsiOk
        ? null
        : `RSI is ${rsi}, which is oversold (≤35). This increases the risk of a short squeeze. Wait for RSI to recover above 40 before entering Short.`,
    });

    // Condition 4: MACD direction
    const macdOk = macdDirection === 'Bearish' || macdDirection === 'Neutral';
    conditions.push({
      label: 'MACD Confirms Bearish Momentum',
      pass: macdOk,
      details: `MACD Direction: ${macdDirection}`,
      failureExplanation: macdOk
        ? null
        : `MACD is Bullish, indicating upward momentum. For a Short entry, MACD should be Bearish or at least Neutral. Wait for MACD to turn around before entering.`,
    });
  }

  const passedCount = conditions.filter((c) => c.pass).length;
  const totalConditions = conditions.length;
  const verdict = computeVerdict(passedCount, totalConditions);
  const summaryMessage = buildSummaryMessage(verdict, passedCount, totalConditions, tradeDirection);

  return { conditionResults: conditions, passedCount, totalConditions, verdict, summaryMessage, params };
}

// Main entry point
export function evaluateEntryConditions(params: TradeEntryParams): EntryEvaluationResult {
  if (params.timeframe === '1m') {
    return evaluate1m(params as TradeEntryParams1m);
  }
  return evaluate15m1h(params as TradeEntryParams15m1h);
}
