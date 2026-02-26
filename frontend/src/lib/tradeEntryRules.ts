export type MACDDirection = 'Bullish' | 'Neutral' | 'Bearish';
export type TradeDirection = 'Long' | 'Short';
export type Verdict = 'go' | 'wait' | 'no-go';

export interface TradeEntryParams {
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

export interface ConditionResult {
  label: string;
  pass: boolean;
  details: string;
  failureExplanation: string | null;
}

export interface EntryEvaluationResult {
  conditionResults: ConditionResult[];
  passedCount: number;
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

export function validateATR(value: string): string | null {
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

// Core evaluation logic
export function evaluateEntryConditions(params: TradeEntryParams): EntryEvaluationResult {
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

    // Condition 3: RSI not overbought
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
    // SHORT conditions

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

    // Condition 3: RSI not oversold
    const rsiOk = rsi > 35;
    conditions.push({
      label: 'RSI Not Oversold (> 35)',
      pass: rsiOk,
      details: `RSI = ${rsi}`,
      failureExplanation: rsiOk
        ? null
        : `RSI is ${rsi}, which is oversold (≤35). This increases the risk of a bounce reversal. Wait for RSI to recover above 40 before entering Short.`,
    });

    // Condition 4: MACD direction
    const macdOk = macdDirection === 'Bearish' || macdDirection === 'Neutral';
    conditions.push({
      label: 'MACD Confirms Bearish Momentum',
      pass: macdOk,
      details: `MACD Direction: ${macdDirection}`,
      failureExplanation: macdOk
        ? null
        : `MACD is Bullish, indicating upward momentum. For a Short entry, MACD should be Bearish or at least Neutral. Wait for MACD to turn downward before entering.`,
    });
  }

  const passedCount = conditions.filter((c) => c.pass).length;

  let verdict: Verdict;
  let summaryMessage: string;

  if (passedCount === 4) {
    verdict = 'go';
    summaryMessage = 'Entry looks good – proceed with caution';
  } else if (passedCount === 3) {
    verdict = 'wait';
    summaryMessage = 'Marginal setup – wait for better confirmation';
  } else {
    verdict = 'no-go';
    summaryMessage = 'Do not enter – setup not confirmed';
  }

  return {
    conditionResults: conditions,
    passedCount,
    verdict,
    summaryMessage,
    params,
  };
}
