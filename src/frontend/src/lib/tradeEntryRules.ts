export type MACDDirection = "Bullish" | "Neutral" | "Bearish";
export type TradeDirection = "Long" | "Short";
export type Verdict = "go" | "wait" | "no-go";
export type Timeframe = "1m" | "15m" | "1h";
export type RSITimeframe = "1m" | "15m" | "1h";
export type EMAAlignment = "bullish" | "bearish" | "mixed";
export type OIDirection = "rising" | "neutral" | "falling";
export type CVDSignal = "bullish" | "neutral" | "bearish";
export type FundingLevel = "strongPositive" | "neutral" | "strongNegative";
export type LiquidationsNear = "longsNear" | "none" | "shortsNear";

export interface OrderflowPattern {
  patternName: string;
  signal: "bullish" | "bearish" | "neutral" | "warning";
  explanation: string;
}

// Params for 1m timeframe
export interface TradeEntryParams1m {
  timeframe: "1m";
  assetName: string;
  currentPrice: number;
  emaAlignment: EMAAlignment;
  rsi: number;
  atr?: number; // optional on 1m
  tradeDirection: TradeDirection;
  rsiTimeframe?: RSITimeframe;
  oiDirection?: OIDirection;
  futureCVD?: CVDSignal;
  spotCVD?: CVDSignal; // optional, kept for backwards compat
  fundingLevel?: FundingLevel;
  liquidationsNear?: LiquidationsNear;
}

// Params for 15m/1h timeframe
export interface TradeEntryParams15m1h {
  timeframe: "15m" | "1h";
  assetName: string;
  currentPrice: number;
  emaAlignment: EMAAlignment;
  rsi: number;
  atr: number;
  macdDirection: MACDDirection;
  tradeDirection: TradeDirection;
  rsiTimeframe?: RSITimeframe;
  oiDirection?: OIDirection;
  futureCVD?: CVDSignal;
  spotCVD?: CVDSignal; // optional, kept for backwards compat
  fundingLevel?: FundingLevel;
  liquidationsNear?: LiquidationsNear;
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
  twapRecommended: boolean;
  twapReason: string;
  orderflowPattern?: OrderflowPattern;
}

// Validation helpers
export function validatePrice(value: string): string | null {
  if (value.trim() === "") return "This field is required.";
  const num = Number.parseFloat(value);
  if (Number.isNaN(num) || num <= 0) return "Must be a positive number.";
  return null;
}

export function validateRSI(value: string): string | null {
  if (value.trim() === "") return "This field is required.";
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return "Must be a number.";
  if (num < 0 || num > 100) return "RSI must be between 0 and 100.";
  return null;
}

export function validateATR(value: string, optional = false): string | null {
  if (optional && value.trim() === "") return null;
  if (value.trim() === "") return "This field is required.";
  const num = Number.parseFloat(value);
  if (Number.isNaN(num) || num <= 0) return "ATR must be greater than 0.";
  return null;
}

export function validateAssetName(value: string): string | null {
  if (value.trim() === "") return "This field is required.";
  return null;
}

function computeVerdict(passedCount: number, totalConditions: number): Verdict {
  if (passedCount === totalConditions) return "go";
  if (passedCount >= Math.ceil(totalConditions / 2)) return "wait";
  return "no-go";
}

function buildSummaryMessage(
  verdict: Verdict,
  passedCount: number,
  totalConditions: number,
  tradeDirection: TradeDirection,
): string {
  if (verdict === "go") {
    return `Alle ${totalConditions} Bedingungen erfüllt. Das Setup ist bereit für einen ${tradeDirection}-Entry.`;
  }
  if (verdict === "wait") {
    return `${passedCount} von ${totalConditions} Bedingungen erfüllt. Einige Signale sind noch nicht ausgerichtet — auf ein besseres Setup warten.`;
  }
  return `Nur ${passedCount} von ${totalConditions} Bedingungen erfüllt. Das Setup ist nicht bereit für einen ${tradeDirection}-Entry. Jetzt nicht einsteigen.`;
}

function getRSIThresholds(
  rsiTf: RSITimeframe | undefined,
  globalTf: Timeframe,
): { longMax: number; shortMin: number } {
  const effective = rsiTf ?? globalTf;
  if (effective === "1m") return { longMax: 75, shortMin: 25 };
  if (effective === "15m") return { longMax: 65, shortMin: 35 };
  // 1h
  return { longMax: 60, shortMin: 40 };
}

/**
 * Simplified TWAP recommendation based on OI and funding.
 * TWAP is recommended when the market is crowded (OI rising + funding strongly positive),
 * meaning entering all at once carries higher reversal risk.
 */
function buildTwapRecommendation(
  oiDirection: OIDirection | undefined,
  fundingLevel: FundingLevel | undefined,
): { twapRecommended: boolean; twapReason: string } {
  if (oiDirection === "rising" && fundingLevel === "strongPositive") {
    return {
      twapRecommended: true,
      twapReason:
        "OI steigt und Funding ist stark positiv — der Markt ist überladen mit Longs. TWAP über 20–30 Minuten reduziert das Risiko eines ungünstigen Einzel-Entries in eine überhitzte Position.",
    };
  }
  return {
    twapRecommended: false,
    twapReason:
      "Marktbedingungen sind für einen einzelnen Limit-Entry geeignet. Kein übermäßiges OI oder Funding-Ungleichgewicht erkennbar.",
  };
}

/**
 * Detects orderflow patterns from OI, CVD and Funding.
 * spotCVD is treated as neutral when absent (no longer collected from UI).
 */
function detectOrderflowPattern(
  params: TradeEntryParams,
): OrderflowPattern | undefined {
  const { oiDirection, futureCVD, fundingLevel } =
    params as TradeEntryParams & {
      oiDirection?: OIDirection;
      futureCVD?: CVDSignal;
      fundingLevel?: FundingLevel;
    };

  // Treat missing spotCVD as neutral
  const spotCVD =
    (params as TradeEntryParams & { spotCVD?: CVDSignal }).spotCVD ?? "neutral";

  // If no orderflow data at all, return undefined
  if (!oiDirection && !futureCVD && !fundingLevel) return undefined;

  const dir = params.tradeDirection;

  // 1. Leverage Pump Trap: Futures drive price up, no real spot buying
  if (
    oiDirection === "rising" &&
    futureCVD === "bullish" &&
    (spotCVD === "neutral" || spotCVD === "bearish")
  ) {
    return {
      patternName: "Leverage Pump Trap",
      signal: "warning",
      explanation:
        "Futures treiben den Move, Spot fehlt. Hohes Dump-Risiko — kein Long Entry ohne Spot-Bestätigung.",
    };
  }

  // 2. Short Squeeze Setup: Shorts trapped, funding negative
  if (oiDirection === "rising" && fundingLevel === "strongNegative") {
    return {
      patternName: "Short Squeeze Setup",
      signal: "bullish",
      explanation:
        "Shorts sitzen fest (OI steigt, Funding negativ). Short Squeeze wahrscheinlich — Long-Bias gerechtfertigt.",
    };
  }

  // 3. Versteckte Akkumulation: Bears pressing, but buying absorbs
  if (
    oiDirection === "rising" &&
    futureCVD === "bearish" &&
    spotCVD === "bullish"
  ) {
    return {
      patternName: "Versteckte Akkumulation",
      signal: "bullish",
      explanation:
        "Shorts drücken aggressiv, Spot absorbiert alles. Short Squeeze Potenzial — bullish.",
    };
  }

  // 4. Starker Trend (Long)
  if (
    dir === "Long" &&
    oiDirection === "rising" &&
    futureCVD === "bullish" &&
    spotCVD === "bullish"
  ) {
    return {
      patternName: "Starker Trend",
      signal: "bullish",
      explanation:
        "Echter Kaufdruck — Futures und Spot bestätigen. Move kann weiterlaufen.",
    };
  }

  // 5. Starker Downtrend (Short)
  if (
    dir === "Short" &&
    oiDirection === "rising" &&
    futureCVD === "bearish" &&
    spotCVD === "bearish"
  ) {
    return {
      patternName: "Starker Downtrend",
      signal: "bearish",
      explanation:
        "Echter Verkaufsdruck — neue Shorts + Spot verkauft. Nachhaltig bearish.",
    };
  }

  // 6. Short Covering: OI falls but price rises
  if (oiDirection === "falling" && futureCVD === "bullish") {
    return {
      patternName: "Short Covering",
      signal: "neutral",
      explanation:
        "Shorts schließen nur — kein echtes Kaufen. Fragiler Bounce.",
    };
  }

  // 7. Long Liquidation Dump
  if (oiDirection === "falling" && futureCVD === "bearish") {
    return {
      patternName: "Long Liquidation Dump",
      signal: "neutral",
      explanation:
        "Zwangsverkäufe, kein struktureller Druck. Oft Reversal-Zone.",
    };
  }

  // 8. Long Squeeze: Longs trapped by high funding
  if (oiDirection === "rising" && fundingLevel === "strongPositive") {
    return {
      patternName: "Long Squeeze",
      signal: "warning",
      explanation:
        "Longs sitzen fest (OI steigt, Funding hoch positiv). Long Squeeze möglich — Vorsicht.",
    };
  }

  return {
    patternName: "Kein klares Muster",
    signal: "neutral",
    explanation:
      "Die Orderflow-Daten zeigen kein eindeutiges Signal. Weitere Bestätigung abwarten.",
  };
}

// Evaluate for 1m timeframe
function evaluate1m(params: TradeEntryParams1m): EntryEvaluationResult {
  const { emaAlignment, rsi, tradeDirection, rsiTimeframe } = params;
  const conditions: ConditionResult[] = [];
  const rsiTh = getRSIThresholds(rsiTimeframe, "1m");

  if (tradeDirection === "Long") {
    // Condition 1: EMA alignment bullish
    const emaAligned = emaAlignment === "bullish";
    conditions.push({
      label: "EMA Ausrichtung bullish (Long)",
      pass: emaAligned,
      details: `EMA Ausrichtung: ${emaAlignment}`,
      failureExplanation: emaAligned
        ? null
        : `EMA-Ausrichtung ist ${emaAlignment === "bearish" ? "bearish (EMA9 < EMA21)" : "gemischt/unklar"}. Für einen Long-Entry im 1m muss EMA9 > EMA21 sein. Warte auf bullishe EMA-Kreuzung.`,
    });

    // Condition 2: RSI not overbought
    const rsiOk = rsi < rsiTh.longMax;
    const rsiTfLabel = rsiTimeframe ?? "1m";
    conditions.push({
      label: `RSI nicht überkauft (< ${rsiTh.longMax}) [${rsiTfLabel}]`,
      pass: rsiOk,
      details: `RSI = ${rsi}`,
      failureExplanation: rsiOk
        ? null
        : `RSI ist ${rsi} (${rsiTfLabel}-Chart), überkauft (≥${rsiTh.longMax}). Warte auf RSI-Rückgang vor Long-Einstieg.`,
    });
  } else {
    // SHORT conditions for 1m

    // Condition 1: EMA alignment bearish
    const emaAligned = emaAlignment === "bearish";
    conditions.push({
      label: "EMA Ausrichtung bearish (Short)",
      pass: emaAligned,
      details: `EMA Ausrichtung: ${emaAlignment}`,
      failureExplanation: emaAligned
        ? null
        : `EMA-Ausrichtung ist ${emaAlignment === "bullish" ? "bullish (EMA9 > EMA21)" : "gemischt/unklar"}. Für einen Short-Entry im 1m muss EMA9 < EMA21 sein. Warte auf bearishe EMA-Kreuzung.`,
    });

    // Condition 2: RSI not oversold
    const rsiOk = rsi > rsiTh.shortMin;
    const rsiTfLabel = rsiTimeframe ?? "1m";
    conditions.push({
      label: `RSI nicht überverkauft (> ${rsiTh.shortMin}) [${rsiTfLabel}]`,
      pass: rsiOk,
      details: `RSI = ${rsi}`,
      failureExplanation: rsiOk
        ? null
        : `RSI ist ${rsi} (${rsiTfLabel}-Chart), überverkauft (≤${rsiTh.shortMin}). Warte auf RSI-Erholung vor Short-Einstieg.`,
    });
  }

  const passedCount = conditions.filter((c) => c.pass).length;
  const totalConditions = conditions.length;
  const verdict = computeVerdict(passedCount, totalConditions);
  const summaryMessage = buildSummaryMessage(
    verdict,
    passedCount,
    totalConditions,
    tradeDirection,
  );
  const { twapRecommended, twapReason } = buildTwapRecommendation(
    params.oiDirection,
    params.fundingLevel,
  );

  return {
    conditionResults: conditions,
    passedCount,
    totalConditions,
    verdict,
    summaryMessage,
    params,
    twapRecommended,
    twapReason,
    orderflowPattern: detectOrderflowPattern(params),
  };
}

// Evaluate for 15m/1h timeframe
function evaluate15m1h(params: TradeEntryParams15m1h): EntryEvaluationResult {
  const { emaAlignment, rsi, macdDirection, tradeDirection, rsiTimeframe } =
    params;
  const conditions: ConditionResult[] = [];
  const rsiTh = getRSIThresholds(rsiTimeframe, params.timeframe);

  if (tradeDirection === "Long") {
    // Condition 1: EMA alignment bullish
    const emaAligned = emaAlignment === "bullish";
    conditions.push({
      label: "EMA Trend Ausrichtung bullish (Long)",
      pass: emaAligned,
      details: `EMA Ausrichtung: ${emaAlignment}`,
      failureExplanation: emaAligned
        ? null
        : `EMA-Ausrichtung ist ${emaAlignment === "bearish" ? "bearish (EMA20 < EMA50 < EMA200)" : "gemischt"}. Für einen Long muss EMA20 > EMA50 > EMA200 sein. Warte bis die Trendstruktur ausgerichtet ist.`,
    });

    // Condition 2: RSI not overbought
    const rsiOk = rsi < rsiTh.longMax;
    const rsiTfLabel = rsiTimeframe ?? params.timeframe;
    conditions.push({
      label: `RSI nicht überkauft (< ${rsiTh.longMax}) [${rsiTfLabel}]`,
      pass: rsiOk,
      details: `RSI = ${rsi}`,
      failureExplanation: rsiOk
        ? null
        : `RSI ist ${rsi} (${rsiTfLabel}-Chart), überkauft (≥${rsiTh.longMax}). Warte auf RSI-Rückgang vor Long-Einstieg.`,
    });

    // Condition 3: MACD confirms bullish
    const macdOk = macdDirection === "Bullish" || macdDirection === "Neutral";
    conditions.push({
      label: "MACD bullish oder neutral (Long)",
      pass: macdOk,
      details: `MACD: ${macdDirection}`,
      failureExplanation: macdOk
        ? null
        : "MACD ist Bearish — Abwärtsmomentum aktiv. Für einen Long-Entry sollte MACD Bullish oder Neutral sein. Warte auf MACD-Wende.",
    });
  } else {
    // SHORT conditions for 15m/1h

    // Condition 1: EMA alignment bearish
    const emaAligned = emaAlignment === "bearish";
    conditions.push({
      label: "EMA Trend Ausrichtung bearish (Short)",
      pass: emaAligned,
      details: `EMA Ausrichtung: ${emaAlignment}`,
      failureExplanation: emaAligned
        ? null
        : `EMA-Ausrichtung ist ${emaAlignment === "bullish" ? "bullish (EMA20 > EMA50 > EMA200)" : "gemischt"}. Für einen Short muss EMA20 < EMA50 < EMA200 sein. Warte auf Bestätigung der Downtrend-Struktur.`,
    });

    // Condition 2: RSI not oversold
    const rsiOk = rsi > rsiTh.shortMin;
    const rsiTfLabel = rsiTimeframe ?? params.timeframe;
    conditions.push({
      label: `RSI nicht überverkauft (> ${rsiTh.shortMin}) [${rsiTfLabel}]`,
      pass: rsiOk,
      details: `RSI = ${rsi}`,
      failureExplanation: rsiOk
        ? null
        : `RSI ist ${rsi} (${rsiTfLabel}-Chart), überverkauft (≤${rsiTh.shortMin}). Warte auf RSI-Erholung vor Short-Einstieg.`,
    });

    // Condition 3: MACD confirms bearish
    const macdOk = macdDirection === "Bearish" || macdDirection === "Neutral";
    conditions.push({
      label: "MACD bearish oder neutral (Short)",
      pass: macdOk,
      details: `MACD: ${macdDirection}`,
      failureExplanation: macdOk
        ? null
        : "MACD ist Bullish — Aufwärtsmomentum aktiv. Für einen Short-Entry sollte MACD Bearish oder Neutral sein. Warte auf MACD-Wende.",
    });
  }

  const passedCount = conditions.filter((c) => c.pass).length;
  const totalConditions = conditions.length;
  const verdict = computeVerdict(passedCount, totalConditions);
  const summaryMessage = buildSummaryMessage(
    verdict,
    passedCount,
    totalConditions,
    tradeDirection,
  );
  const { twapRecommended, twapReason } = buildTwapRecommendation(
    params.oiDirection,
    params.fundingLevel,
  );

  return {
    conditionResults: conditions,
    passedCount,
    totalConditions,
    verdict,
    summaryMessage,
    params,
    twapRecommended,
    twapReason,
    orderflowPattern: detectOrderflowPattern(params),
  };
}

// Main entry point
export function evaluateEntryConditions(
  params: TradeEntryParams,
): EntryEvaluationResult {
  if (params.timeframe === "1m") {
    return evaluate1m(params as TradeEntryParams1m);
  }
  return evaluate15m1h(params as TradeEntryParams15m1h);
}
