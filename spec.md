# Specification

## Summary
**Goal:** Add a timeframe selector (1m, 15m, 1h) to the Trade Entry Checker form and adapt all indicator inputs, validation rules, and results display based on the selected timeframe.

**Planned changes:**
- Add a prominent timeframe selector (segmented control/button group) with options 1m, 15m, 1h defaulting to 1m, positioned before the indicator inputs in the Trade Entry Checker form.
- For 1m: show EMA9 and EMA21 fields only; for 15m and 1h: show EMA20, EMA50, and EMA200 fields.
- For 1m: hide the MACD Direction dropdown and show a short informational note ("MACD is not recommended for 1m charts due to excessive noise."); for 15m and 1h: keep MACD as before.
- For 1m: mark ATR as optional and show a note that ATR on 1m is only an activity filter, not for SL/TP; for 15m and 1h: ATR remains required with the standard description.
- Update the rule engine to evaluate timeframe-specific conditions: 1m uses EMA9/EMA21 alignment, optional ATR proximity to EMA9, and RSI thresholds < 75 (Long) / > 25 (Short) with no MACD; 15m and 1h use EMA20/EMA50/EMA200 alignment, ATR proximity to EMA20, RSI < 65 (Long) / > 35 (Short), and MACD direction.
- Display the selected timeframe as a label/badge in the results summary card alongside the asset name and trade direction.
- Reset button clears the timeframe selector back to 1m.

**User-visible outcome:** Users can select a timeframe (1m, 15m, or 1h) in the Trade Entry Checker, see indicator fields and rules adapted to that timeframe, and always know which timeframe a verdict was calculated for.
