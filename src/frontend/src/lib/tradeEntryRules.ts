export type MACDDirection = "Bullish" | "Neutral" | "Bearish";
export type TradeDirection = "Long" | "Short";
export type Verdict = "go" | "wait" | "no-go";
export type Timeframe = "1m" | "15m" | "1h";
export type RSITimeframe = "1m" | "15m" | "1h";
export type OrderbookImbalance = "moreBids" | "balanced" | "moreAsks";
export type VolumeLevel = "above" | "average" | "below";
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
  ema9: number;
  ema21: number;
  rsi: number;
  atr?: number; // optional on 1m
  tradeDirection: TradeDirection;
  rsiTimeframe?: RSITimeframe;
  bidAskSpread?: number;
  orderbookImbalance?: OrderbookImbalance;
  volumeLevel?: VolumeLevel;
  oiDirection?: OIDirection;
  futureCVD?: CVDSignal;
  spotCVD?: CVDSignal;
  fundingLevel?: FundingLevel;
  liquidationsNear?: LiquidationsNear;
}

// Params for 15m/1h timeframe
export interface TradeEntryParams15m1h {
  timeframe: "15m" | "1h";
  assetName: string;
  currentPrice: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  atr: number;
  macdDirection: MACDDirection;
  tradeDirection: TradeDirection;
  rsiTimeframe?: RSITimeframe;
  bidAskSpread?: number;
  orderbookImbalance?: OrderbookImbalance;
  volumeLevel?: VolumeLevel;
  oiDirection?: OIDirection;
  futureCVD?: CVDSignal;
  spotCVD?: CVDSignal;
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

export function validateEMA(value: string, label: string): string | null {
  if (value.trim() === "") return "This field is required.";
  const num = Number.parseFloat(value);
  if (Number.isNaN(num) || num <= 0)
    return `${label} must be a positive number.`;
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
    return `All ${totalConditions} conditions are met. The setup looks clean for a ${tradeDirection} entry.`;
  }
  if (verdict === "wait") {
    return `${passedCount} of ${totalConditions} conditions met. Some signals are not aligned yet — wait for a better setup.`;
  }
  return `Only ${passedCount} of ${totalConditions} conditions met. The setup is not ready for a ${tradeDirection} entry. Do not enter now.`;
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

function buildTwapRecommendation(
  currentPrice: number,
  bidAskSpread: number | undefined,
  orderbookImbalance: OrderbookImbalance | undefined,
  volumeLevel: VolumeLevel | undefined,
): { twapRecommended: boolean; twapReason: string } {
  const reasons: string[] = [];

  if (bidAskSpread !== undefined) {
    const spreadPct = (bidAskSpread / currentPrice) * 100;
    if (spreadPct > 0.1) {
      reasons.push(
        `Bid/Ask Spread von ${spreadPct.toFixed(3)}% ist erhöht (>0.1%) — TWAP reduziert Slippage`,
      );
    }
  }
  if (volumeLevel === "below") {
    reasons.push(
      "Volumen ist unterdurchschnittlich — niedrige Liquidität begünstigt gestaffelten Einstieg",
    );
  }
  if (orderbookImbalance === "balanced") {
    reasons.push(
      "Orderbook ist ausgeglichen — kein starkes Signal, TWAP gibt mehr Flexibilität",
    );
  }

  if (reasons.length > 0) {
    return {
      twapRecommended: true,
      twapReason: `${reasons.join(". ")}.`,
    };
  }

  return {
    twapRecommended: false,
    twapReason:
      "Spread, Volumen und Orderbook zeigen gute Konditionen — ein einzelner Limit-Entry ist ausreichend.",
  };
}

function detectOrderflowPattern(
  params: TradeEntryParams,
): OrderflowPattern | undefined {
  const { oiDirection, futureCVD, spotCVD, fundingLevel } =
    params as TradeEntryParams & {
      oiDirection?: OIDirection;
      futureCVD?: CVDSignal;
      spotCVD?: CVDSignal;
      fundingLevel?: FundingLevel;
      liquidationsNear?: LiquidationsNear;
    };

  // If no orderflow data provided, return undefined
  if (!oiDirection && !futureCVD && !spotCVD && !fundingLevel) return undefined;

  const dir = params.tradeDirection;

  // 1. Leverage Pump Trap
  if (
    oiDirection === "rising" &&
    futureCVD === "bullish" &&
    (spotCVD === "neutral" || spotCVD === "bearish")
  ) {
    return {
      patternName: "Leverage Pump Trap",
      signal: "warning",
      explanation:
        "Futures treiben den Move, Spot fehlt. Hohes Dump-Risiko — kein Long Entry.",
    };
  }

  // 2. Short Squeeze Setup
  if (
    oiDirection === "rising" &&
    fundingLevel === "strongNegative" &&
    spotCVD === "bullish"
  ) {
    return {
      patternName: "Short Squeeze Setup",
      signal: "bullish",
      explanation:
        "Shorts sitzen fest und Spot kauft. Short Squeeze wahrscheinlich.",
    };
  }

  // 3. Versteckte Akkumulation
  if (
    oiDirection === "rising" &&
    futureCVD === "bearish" &&
    spotCVD === "bullish"
  ) {
    return {
      patternName: "Versteckte Akkumulation",
      signal: "bullish",
      explanation:
        "Shorts drücken aggressiv, Spot absorbiert alles. Short Squeeze Potenzial.",
    };
  }

  // 4. Starker Trend (Long only)
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

  // 5. Starker Downtrend (Short only)
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

  // 6. Short Covering
  if (
    oiDirection === "falling" &&
    futureCVD === "bullish" &&
    spotCVD === "neutral"
  ) {
    return {
      patternName: "Short Covering",
      signal: "neutral",
      explanation:
        "Shorts schließen nur — kein echtes Kaufen. Fragiler Bounce.",
    };
  }

  // 7. Long Liquidation Dump
  if (
    oiDirection === "falling" &&
    futureCVD === "bearish" &&
    spotCVD === "neutral"
  ) {
    return {
      patternName: "Long Liquidation Dump",
      signal: "neutral",
      explanation:
        "Zwangsverkäufe, kein struktureller Druck. Oft Reversal-Zone.",
    };
  }

  // 8. Long Squeeze
  if (
    oiDirection === "rising" &&
    fundingLevel === "strongPositive" &&
    (spotCVD === "neutral" || spotCVD === "bearish")
  ) {
    return {
      patternName: "Long Squeeze",
      signal: "warning",
      explanation: "Longs sitzen fest, Spot fehlt. Long Squeeze möglich.",
    };
  }

  // No specific pattern
  return {
    patternName: "Kein klares Muster",
    signal: "neutral",
    explanation:
      "Die Orderflow-Daten zeigen kein eindeutiges Signal. Weitere Bestätigung abwarten.",
  };
}

// Evaluate for 1m timeframe
function evaluate1m(params: TradeEntryParams1m): EntryEvaluationResult {
  const {
    currentPrice,
    ema9,
    ema21,
    rsi,
    atr,
    tradeDirection,
    rsiTimeframe,
    bidAskSpread,
    orderbookImbalance,
    volumeLevel,
  } = params;
  const conditions: ConditionResult[] = [];
  const rsiTh = getRSIThresholds(rsiTimeframe, "1m");

  if (tradeDirection === "Long") {
    // Condition 1: EMA9 > EMA21 alignment
    const emaAligned = ema9 > ema21;
    conditions.push({
      label: "EMA9 > EMA21 (Short-term Bullish)",
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
        label: "Price Not Overextended Above EMA9",
        pass: notOverextended,
        details: `Price (${currentPrice}) ≤ EMA9 + 1×ATR (${(ema9 + atr).toFixed(4)})`,
        failureExplanation: notOverextended
          ? null
          : `Price (${currentPrice}) is overextended above EMA9 by more than 1×ATR (${atr}). Wait for a pullback to EMA9 (${ema9}) before entering Long.`,
      });
    }

    // Condition 3: RSI not overbought
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

    // Orderbook condition (optional)
    if (orderbookImbalance !== undefined) {
      const obOk =
        orderbookImbalance === "moreBids" || orderbookImbalance === "balanced";
      const obLabel = {
        moreBids: "Mehr Bids (bullish)",
        balanced: "Ausgeglichen",
        moreAsks: "Mehr Asks (bearish)",
      }[orderbookImbalance];
      conditions.push({
        label: "Orderbook bullish oder neutral (Long)",
        pass: obOk,
        details: `Orderbook: ${obLabel}`,
        failureExplanation: obOk
          ? null
          : "Orderbook zeigt mehr Asks als Bids — bärischer Druck. Kein optimaler Long-Einstieg.",
      });
    }

    // Volume condition (optional)
    if (volumeLevel !== undefined) {
      const volOk = volumeLevel !== "below";
      const volLabel = {
        above: "Über Durchschnitt",
        average: "Durchschnitt",
        below: "Unter Durchschnitt",
      }[volumeLevel];
      conditions.push({
        label: "Volumen ausreichend",
        pass: volOk,
        details: `Volumen: ${volLabel}`,
        failureExplanation: volOk
          ? null
          : "Unterdurchschnittliches Volumen erhöht Slippage-Risiko. TWAP-Entry empfohlen.",
      });
    }
  } else {
    // SHORT conditions for 1m

    // Condition 1: EMA9 < EMA21 alignment
    const emaAligned = ema9 < ema21;
    conditions.push({
      label: "EMA9 < EMA21 (Short-term Bearish)",
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
        label: "Price Not Overextended Below EMA9",
        pass: notOverextended,
        details: `Price (${currentPrice}) ≥ EMA9 − 1×ATR (${(ema9 - atr).toFixed(4)})`,
        failureExplanation: notOverextended
          ? null
          : `Price (${currentPrice}) is overextended below EMA9 by more than 1×ATR (${atr}). Wait for a bounce back toward EMA9 (${ema9}) before entering Short.`,
      });
    }

    // Condition 3: RSI not oversold
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

    // Orderbook condition (optional)
    if (orderbookImbalance !== undefined) {
      const obOk =
        orderbookImbalance === "moreAsks" || orderbookImbalance === "balanced";
      const obLabel = {
        moreBids: "Mehr Bids (bullish)",
        balanced: "Ausgeglichen",
        moreAsks: "Mehr Asks (bearish)",
      }[orderbookImbalance];
      conditions.push({
        label: "Orderbook bearish oder neutral (Short)",
        pass: obOk,
        details: `Orderbook: ${obLabel}`,
        failureExplanation: obOk
          ? null
          : "Orderbook zeigt mehr Bids als Asks — bullisher Druck. Kein optimaler Short-Einstieg.",
      });
    }

    // Volume condition (optional)
    if (volumeLevel !== undefined) {
      const volOk = volumeLevel !== "below";
      const volLabel = {
        above: "Über Durchschnitt",
        average: "Durchschnitt",
        below: "Unter Durchschnitt",
      }[volumeLevel];
      conditions.push({
        label: "Volumen ausreichend",
        pass: volOk,
        details: `Volumen: ${volLabel}`,
        failureExplanation: volOk
          ? null
          : "Unterdurchschnittliches Volumen erhöht Slippage-Risiko. TWAP-Entry empfohlen.",
      });
    }
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
    currentPrice,
    bidAskSpread,
    orderbookImbalance,
    volumeLevel,
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
  const {
    currentPrice,
    ema20,
    ema50,
    ema200,
    rsi,
    atr,
    macdDirection,
    tradeDirection,
    rsiTimeframe,
    bidAskSpread,
    orderbookImbalance,
    volumeLevel,
  } = params;
  const conditions: ConditionResult[] = [];
  const rsiTh = getRSIThresholds(rsiTimeframe, params.timeframe);

  if (tradeDirection === "Long") {
    // Condition 1: EMA trend alignment (EMA20 > EMA50 > EMA200)
    const emaAligned = ema20 > ema50 && ema50 > ema200;
    conditions.push({
      label: "EMA Trend Alignment (Bullish)",
      pass: emaAligned,
      details: `EMA20 (${ema20}) > EMA50 (${ema50}) > EMA200 (${ema200})`,
      failureExplanation: emaAligned
        ? null
        : `EMA alignment is not bullish. Currently: EMA20=${ema20}, EMA50=${ema50}, EMA200=${ema200}. For a Long, you need EMA20 > EMA50 > EMA200. Wait until the trend structure aligns.`,
    });

    // Condition 2: Price proximity – not overextended above EMA20
    const notOverextended = currentPrice <= ema20 + atr;
    conditions.push({
      label: "Price Not Overextended Above EMA20",
      pass: notOverextended,
      details: `Price (${currentPrice}) ≤ EMA20 + 1×ATR (${(ema20 + atr).toFixed(4)})`,
      failureExplanation: notOverextended
        ? null
        : `Price (${currentPrice}) is overextended above EMA20 by more than 1×ATR (${atr}). The ideal entry is a pullback to EMA20 (${ema20}). Wait for price to return closer to EMA20 before entering.`,
    });

    // Condition 3: RSI not overbought
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

    // Condition 4: MACD direction
    const macdOk = macdDirection === "Bullish" || macdDirection === "Neutral";
    conditions.push({
      label: "MACD Confirms Bullish Momentum",
      pass: macdOk,
      details: `MACD Direction: ${macdDirection}`,
      failureExplanation: macdOk
        ? null
        : "MACD is Bearish, indicating downward momentum. For a Long entry, MACD should be Bullish or at least Neutral. Wait for MACD to turn around before entering.",
    });

    // Orderbook condition (optional)
    if (orderbookImbalance !== undefined) {
      const obOk =
        orderbookImbalance === "moreBids" || orderbookImbalance === "balanced";
      const obLabel = {
        moreBids: "Mehr Bids (bullish)",
        balanced: "Ausgeglichen",
        moreAsks: "Mehr Asks (bearish)",
      }[orderbookImbalance];
      conditions.push({
        label: "Orderbook bullish oder neutral (Long)",
        pass: obOk,
        details: `Orderbook: ${obLabel}`,
        failureExplanation: obOk
          ? null
          : "Orderbook zeigt mehr Asks als Bids — bärischer Druck. Kein optimaler Long-Einstieg.",
      });
    }

    // Volume condition (optional)
    if (volumeLevel !== undefined) {
      const volOk = volumeLevel !== "below";
      const volLabel = {
        above: "Über Durchschnitt",
        average: "Durchschnitt",
        below: "Unter Durchschnitt",
      }[volumeLevel];
      conditions.push({
        label: "Volumen ausreichend",
        pass: volOk,
        details: `Volumen: ${volLabel}`,
        failureExplanation: volOk
          ? null
          : "Unterdurchschnittliches Volumen erhöht Slippage-Risiko. TWAP-Entry empfohlen.",
      });
    }
  } else {
    // SHORT conditions for 15m/1h

    // Condition 1: EMA trend alignment (EMA20 < EMA50 < EMA200)
    const emaAligned = ema20 < ema50 && ema50 < ema200;
    conditions.push({
      label: "EMA Trend Alignment (Bearish)",
      pass: emaAligned,
      details: `EMA20 (${ema20}) < EMA50 (${ema50}) < EMA200 (${ema200})`,
      failureExplanation: emaAligned
        ? null
        : `EMA alignment is not bearish. Currently: EMA20=${ema20}, EMA50=${ema50}, EMA200=${ema200}. For a Short, you need EMA20 < EMA50 < EMA200. Wait until the downtrend structure is confirmed.`,
    });

    // Condition 2: Price proximity – not overextended below EMA20
    const notOverextended = currentPrice >= ema20 - atr;
    conditions.push({
      label: "Price Not Overextended Below EMA20",
      pass: notOverextended,
      details: `Price (${currentPrice}) ≥ EMA20 − 1×ATR (${(ema20 - atr).toFixed(4)})`,
      failureExplanation: notOverextended
        ? null
        : `Price (${currentPrice}) is overextended below EMA20 by more than 1×ATR (${atr}). The ideal Short entry is a pullback to EMA20 (${ema20}). Wait for price to bounce back toward EMA20 before entering Short.`,
    });

    // Condition 3: RSI not oversold
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

    // Condition 4: MACD direction
    const macdOk = macdDirection === "Bearish" || macdDirection === "Neutral";
    conditions.push({
      label: "MACD Confirms Bearish Momentum",
      pass: macdOk,
      details: `MACD Direction: ${macdDirection}`,
      failureExplanation: macdOk
        ? null
        : "MACD is Bullish, indicating upward momentum. For a Short entry, MACD should be Bearish or at least Neutral. Wait for MACD to turn around before entering.",
    });

    // Orderbook condition (optional)
    if (orderbookImbalance !== undefined) {
      const obOk =
        orderbookImbalance === "moreAsks" || orderbookImbalance === "balanced";
      const obLabel = {
        moreBids: "Mehr Bids (bullish)",
        balanced: "Ausgeglichen",
        moreAsks: "Mehr Asks (bearish)",
      }[orderbookImbalance];
      conditions.push({
        label: "Orderbook bearish oder neutral (Short)",
        pass: obOk,
        details: `Orderbook: ${obLabel}`,
        failureExplanation: obOk
          ? null
          : "Orderbook zeigt mehr Bids als Asks — bullisher Druck. Kein optimaler Short-Einstieg.",
      });
    }

    // Volume condition (optional)
    if (volumeLevel !== undefined) {
      const volOk = volumeLevel !== "below";
      const volLabel = {
        above: "Über Durchschnitt",
        average: "Durchschnitt",
        below: "Unter Durchschnitt",
      }[volumeLevel];
      conditions.push({
        label: "Volumen ausreichend",
        pass: volOk,
        details: `Volumen: ${volLabel}`,
        failureExplanation: volOk
          ? null
          : "Unterdurchschnittliches Volumen erhöht Slippage-Risiko. TWAP-Entry empfohlen.",
      });
    }
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
    currentPrice,
    bidAskSpread,
    orderbookImbalance,
    volumeLevel,
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
