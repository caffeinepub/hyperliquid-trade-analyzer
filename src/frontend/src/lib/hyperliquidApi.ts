export interface HyperliquidLiveData {
  price: number;
  oiDirection: "rising" | "neutral" | "falling";
  fundingLevel: "strongPositive" | "neutral" | "strongNegative";
  futureCVD: "bullish" | "neutral" | "bearish";
  rawFunding: number; // per 8h as decimal, e.g. 0.0001 = 0.01% per 8h
  rawOI: number;
  cvdDelta: number; // raw buy vol - sell vol
}

/**
 * Extracts the base coin name from user input like "BTC/USDC", "BRENTOIL/USDC", "XAG", etc.
 */
function extractCoinName(input: string): string {
  return input.split("/")[0].split("-")[0].trim().toUpperCase();
}

/**
 * Fetches live data for a given coin from the Hyperliquid public API.
 * Makes two parallel requests:
 * 1. metaAndAssetCtxs  – price, open interest, funding rate
 * 2. recentTrades      – for CVD (Cumulative Volume Delta) calculation
 *
 * Note: OI direction is derived from funding rate as a proxy since we have no
 * historical OI snapshots available client-side.
 */
export async function fetchHyperliquidLiveData(
  coin: string,
): Promise<HyperliquidLiveData> {
  const coinName = extractCoinName(coin);
  const BASE_URL = "https://api.hyperliquid.xyz/info";

  try {
    const [metaRes, tradesRes] = await Promise.all([
      fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      }),
      fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "recentTrades", coin: coinName }),
      }),
    ]);

    if (!metaRes.ok) {
      throw new Error(`Metadaten-Fehler: ${metaRes.status}`);
    }

    const metaData = await metaRes.json();

    // metaAndAssetCtxs returns [meta, assetCtxs]
    // meta.universe is Array<{ name: string; szDecimals: number; ... }>
    // assetCtxs is Array<{ markPx: string; openInterest: string; funding: string; ... }>
    const [meta, assetCtxs] = metaData as [
      { universe: Array<{ name: string; szDecimals: number }> },
      Array<{ markPx: string; openInterest: string; funding: string }>,
    ];

    const coinIndex = meta.universe.findIndex(
      (u) => u.name.toLowerCase() === coinName.toLowerCase(),
    );

    if (coinIndex === -1) {
      throw new Error(
        `Asset "${coinName}" nicht auf Hyperliquid gefunden. Bitte Namen prüfen (z.B. BTC, XAG, BRENTOIL).`,
      );
    }

    const assetCtx = assetCtxs[coinIndex];
    const price = Number.parseFloat(assetCtx.markPx);
    const rawOI = Number.parseFloat(assetCtx.openInterest);
    // funding is per 8h as a decimal (e.g. 0.0001 = 0.01% per 8h)
    const rawFunding = Number.parseFloat(assetCtx.funding);

    // --- OI Direction ---
    // We use funding rate as a proxy for OI direction since no historical OI baseline
    // is available. Positive funding → longs dominant → OI effectively "rising".
    // Threshold: 0.0005 per 8h (= 0.05% per 8h = significant imbalance)
    let oiDirection: "rising" | "neutral" | "falling";
    if (rawFunding > 0.0005) {
      oiDirection = "rising";
    } else if (rawFunding < -0.0005) {
      oiDirection = "falling";
    } else {
      oiDirection = "neutral";
    }

    // --- Funding Level ---
    // Same thresholds: > 0.0005 per 8h = strongly positive (longs paying heavily)
    let fundingLevel: "strongPositive" | "neutral" | "strongNegative";
    if (rawFunding > 0.0005) {
      fundingLevel = "strongPositive";
    } else if (rawFunding < -0.0005) {
      fundingLevel = "strongNegative";
    } else {
      fundingLevel = "neutral";
    }

    // --- Futures CVD from recent trades ---
    let futureCVD: "bullish" | "neutral" | "bearish" = "neutral";
    let cvdDelta = 0;

    if (tradesRes.ok) {
      const tradesData = await tradesRes.json();
      const trades = tradesData as Array<{
        side: "B" | "A";
        sz: string;
        px: string;
      }>;

      let buyVolume = 0;
      let sellVolume = 0;

      for (const trade of trades) {
        const volume =
          Number.parseFloat(trade.sz) * Number.parseFloat(trade.px);
        if (trade.side === "B") {
          buyVolume += volume;
        } else {
          sellVolume += volume;
        }
      }

      const totalVolume = buyVolume + sellVolume;
      cvdDelta = buyVolume - sellVolume;

      // Neutral if |delta| < 5% of total volume
      if (totalVolume === 0 || Math.abs(cvdDelta) < totalVolume * 0.05) {
        futureCVD = "neutral";
      } else if (cvdDelta > 0) {
        futureCVD = "bullish";
      } else {
        futureCVD = "bearish";
      }
    }
    // If trades request failed, CVD stays neutral — not a hard error

    return {
      price,
      oiDirection,
      fundingLevel,
      futureCVD,
      rawFunding,
      rawOI,
      cvdDelta,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("nicht auf Hyperliquid") ||
        error.message.includes("Metadaten-Fehler"))
    ) {
      throw error;
    }
    throw new Error(
      "Hyperliquid API nicht erreichbar. Bitte Werte manuell eingeben.",
    );
  }
}
