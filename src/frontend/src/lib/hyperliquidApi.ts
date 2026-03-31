export interface HyperliquidLiveData {
  price: number;
  oiDirection: "rising" | "neutral" | "falling";
  fundingLevel: "strongPositive" | "neutral" | "strongNegative";
  futureCVD: "bullish" | "neutral" | "bearish";
  rawFunding: number;
  rawOI: number;
  cvdDelta: number;
  resolvedName?: string; // actual ticker found on HL
}

/**
 * Assets that are known to be unavailable on Hyperliquid entirely.
 * SILVER/XAG/SILBER are now routed via xyz: prefix — do NOT list them here.
 */
export const KNOWN_UNAVAILABLE_ASSETS = new Set<string>([
  // Currently empty — previously listed SILVER here but it is available via xyz:SILVER
]);

/**
 * Returns true if the given coin is known to be unavailable on Hyperliquid.
 * Normalizes the input (uppercase, strips /pair suffix).
 */
export function isKnownUnavailable(coin: string): boolean {
  const normalized = coin.split("/")[0].split("-")[0].trim().toUpperCase();
  return KNOWN_UNAVAILABLE_ASSETS.has(normalized);
}

/**
 * Asset aliases: user-friendly names → Hyperliquid API ticker candidates.
 * xyz: prefix = HIP-3 perpetuals (provider-namespaced assets).
 */
export const ASSET_ALIASES: Record<string, string[]> = {
  // Brent Oil
  BRENTOIL: ["xyz:BRENT", "BRENT", "kBRENT"],
  BRENTOIL_USDC: ["xyz:BRENT", "BRENT", "kBRENT"],
  BRENT_OIL: ["xyz:BRENT", "BRENT", "kBRENT"],
  BRENT: ["xyz:BRENT", "BRENT", "kBRENT"],
  // WTI Oil
  CRUDE: ["xyz:OIL", "OIL", "kOIL"],
  WTI: ["xyz:OIL", "OIL", "kOIL"],
  OIL: ["xyz:OIL", "OIL", "kOIL"],
  // Gold
  XAU: ["xyz:GOLD", "GOLD", "kGOLD"],
  GOLD: ["xyz:GOLD", "GOLD", "kGOLD"],
  // Silver — HIP-3 xyz provider
  SILVER: ["xyz:SILVER", "SILVER"],
  XAG: ["xyz:SILVER", "SILVER"],
  SILBER: ["xyz:SILVER", "SILVER"],
  // Copper
  XCU: ["xyz:COPPER", "COPPER", "kCOPPER"],
  KUPFER: ["xyz:COPPER", "COPPER", "kCOPPER"],
  COPPER: ["xyz:COPPER", "COPPER", "kCOPPER"],
  // Other known xyz assets
  WTIOIL: ["xyz:WTIOIL", "WTIOIL"],
  PALLADIUM: ["xyz:PALLADIUM", "PALLADIUM"],
};

/** Returns ordered list of ticker candidates to try */
function getCandidates(input: string): string[] {
  const raw = input.split("/")[0].split("-")[0].trim().toUpperCase();
  const aliases = ASSET_ALIASES[raw];
  if (aliases) return aliases;
  // For unknown assets, also try k-prefix variant
  return [raw, `k${raw}`];
}

function computeCVD(
  trades: Array<{ side: "B" | "A"; sz: string; px: string }>,
): { futureCVD: "bullish" | "neutral" | "bearish"; cvdDelta: number } {
  let buyVolume = 0;
  let sellVolume = 0;
  for (const trade of trades) {
    const volume = Number.parseFloat(trade.sz) * Number.parseFloat(trade.px);
    if (trade.side === "B") buyVolume += volume;
    else sellVolume += volume;
  }
  const totalVolume = buyVolume + sellVolume;
  const cvdDelta = buyVolume - sellVolume;
  let futureCVD: "bullish" | "neutral" | "bearish" = "neutral";
  if (totalVolume > 0 && Math.abs(cvdDelta) >= totalVolume * 0.05) {
    futureCVD = cvdDelta > 0 ? "bullish" : "bearish";
  }
  return { futureCVD, cvdDelta };
}

/**
 * Handle HIP-3 xyz: prefixed assets (e.g. xyz:SILVER).
 * Price from l2Book midpoint, funding from fundingHistory, CVD from recentTrades.
 * OI is NOT available for xyz assets.
 */
async function tryXyzLookup(
  coinName: string, // e.g. "xyz:SILVER"
  BASE_URL: string,
): Promise<HyperliquidLiveData | null> {
  try {
    // --- Price: midpoint of best bid/ask from l2Book ---
    const bookRes = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "l2Book",
        coin: coinName,
        nSigFigs: 5,
      }),
    });
    if (!bookRes.ok) return null;

    const bookData = (await bookRes.json()) as {
      coin: string;
      time: number;
      levels: Array<Array<{ px: string; sz: string; n: number }>>;
    };

    const bids = bookData.levels?.[0];
    const asks = bookData.levels?.[1];
    if (!bids?.length || !asks?.length) return null;

    const bestBid = Number.parseFloat(bids[0].px);
    const bestAsk = Number.parseFloat(asks[0].px);
    if (Number.isNaN(bestBid) || Number.isNaN(bestAsk)) return null;
    const price = (bestBid + bestAsk) / 2;

    // --- Funding: most recent entry from fundingHistory ---
    let rawFunding = 0;
    try {
      const startTime = Date.now() - 8 * 60 * 60 * 1000; // 8 hours ago
      const fundingRes = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "fundingHistory",
          coin: coinName,
          startTime,
        }),
      });
      if (fundingRes.ok) {
        const fundingData = (await fundingRes.json()) as Array<{
          coin: string;
          fundingRate: string;
          premium: string;
          time: number;
        }>;
        if (fundingData.length > 0) {
          // Last entry is the most recent
          rawFunding = Number.parseFloat(
            fundingData[fundingData.length - 1].fundingRate,
          );
        }
      }
    } catch {
      // Funding not critical
    }

    const fundingLevel: "strongPositive" | "neutral" | "strongNegative" =
      rawFunding > 0.0005
        ? "strongPositive"
        : rawFunding < -0.0005
          ? "strongNegative"
          : "neutral";

    // oiDirection derived from funding sign (OI value unavailable for xyz assets)
    const oiDirection: "rising" | "neutral" | "falling" =
      rawFunding > 0.0005
        ? "rising"
        : rawFunding < -0.0005
          ? "falling"
          : "neutral";

    // --- CVD: from recentTrades ---
    let futureCVD: "bullish" | "neutral" | "bearish" = "neutral";
    let cvdDelta = 0;
    try {
      const tradesRes = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "recentTrades", coin: coinName }),
      });
      if (tradesRes.ok) {
        const tradesData = await tradesRes.json();
        const result = computeCVD(
          tradesData as Array<{ side: "B" | "A"; sz: string; px: string }>,
        );
        futureCVD = result.futureCVD;
        cvdDelta = result.cvdDelta;
      }
    } catch {
      // CVD not critical
    }

    return {
      price,
      oiDirection,
      fundingLevel,
      futureCVD,
      rawFunding,
      rawOI: 0, // Not available for xyz assets
      cvdDelta,
      resolvedName: coinName,
    };
  } catch {
    return null;
  }
}

async function tryPerpLookupForName(
  coinName: string,
  BASE_URL: string,
  metaData: [
    { universe: Array<{ name: string; szDecimals: number }> },
    Array<{ markPx: string; openInterest: string; funding: string }>,
  ],
): Promise<HyperliquidLiveData | null> {
  const [meta, assetCtxs] = metaData;

  const coinIndex = meta.universe.findIndex(
    (u) => u.name.toLowerCase() === coinName.toLowerCase(),
  );

  if (coinIndex === -1) return null;

  const assetCtx = assetCtxs[coinIndex];
  const price = Number.parseFloat(assetCtx.markPx);
  const rawOI = Number.parseFloat(assetCtx.openInterest);
  const rawFunding = Number.parseFloat(assetCtx.funding);

  const oiDirection: "rising" | "neutral" | "falling" =
    rawFunding > 0.0005
      ? "rising"
      : rawFunding < -0.0005
        ? "falling"
        : "neutral";
  const fundingLevel: "strongPositive" | "neutral" | "strongNegative" =
    rawFunding > 0.0005
      ? "strongPositive"
      : rawFunding < -0.0005
        ? "strongNegative"
        : "neutral";

  // Fetch trades for CVD
  let futureCVD: "bullish" | "neutral" | "bearish" = "neutral";
  let cvdDelta = 0;
  try {
    const tradesRes = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "recentTrades", coin: coinName }),
    });
    if (tradesRes.ok) {
      const tradesData = await tradesRes.json();
      const result = computeCVD(
        tradesData as Array<{ side: "B" | "A"; sz: string; px: string }>,
      );
      futureCVD = result.futureCVD;
      cvdDelta = result.cvdDelta;
    }
  } catch {
    // CVD not critical
  }

  return {
    price,
    oiDirection,
    fundingLevel,
    futureCVD,
    rawFunding,
    rawOI,
    cvdDelta,
    resolvedName: coinName,
  };
}

async function tryPerpLookup(
  candidates: string[],
  BASE_URL: string,
): Promise<HyperliquidLiveData | null> {
  // Filter out xyz: candidates — those go through tryXyzLookup
  const perpCandidates = candidates.filter((c) => !c.startsWith("xyz:"));
  if (perpCandidates.length === 0) return null;

  // Fetch meta once for all candidates
  const metaRes = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });

  if (!metaRes.ok) return null;

  const metaData = (await metaRes.json()) as [
    { universe: Array<{ name: string; szDecimals: number }> },
    Array<{ markPx: string; openInterest: string; funding: string }>,
  ];

  for (const candidate of perpCandidates) {
    const result = await tryPerpLookupForName(candidate, BASE_URL, metaData);
    if (result) return result;
  }
  return null;
}

async function trySpotLookup(
  candidates: string[],
  BASE_URL: string,
): Promise<HyperliquidLiveData | null> {
  // Filter out xyz: candidates
  const spotCandidates = candidates.filter((c) => !c.startsWith("xyz:"));
  if (spotCandidates.length === 0) return null;

  const metaRes = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "spotMetaAndAssetCtxs" }),
  });

  if (!metaRes.ok) return null;

  const metaData = await metaRes.json();
  const [spotMeta, spotCtxs] = metaData as [
    {
      universe: Array<{ name: string; tokens: number[]; index: number }>;
      tokens: Array<{ name: string; index: number }>;
    },
    Array<{
      markPx: string;
      dayNtlVlm: string;
      prevDayPx: string;
      coin: string;
    }>,
  ];

  for (const coinName of spotCandidates) {
    // Try matching by universe name (e.g. "SILVER/USDC") or exact name
    let spotIndex = spotMeta.universe.findIndex(
      (u) =>
        u.name.toLowerCase() === coinName.toLowerCase() ||
        u.name.toLowerCase().startsWith(`${coinName.toLowerCase()}/`),
    );

    if (spotIndex === -1) {
      // Try matching by token name
      const tokenIndex = spotMeta.tokens.findIndex(
        (t) => t.name.toLowerCase() === coinName.toLowerCase(),
      );
      if (tokenIndex !== -1) {
        spotIndex = spotMeta.universe.findIndex((u) =>
          u.tokens.includes(tokenIndex),
        );
      }
    }

    if (spotIndex === -1) continue;

    const ctx = spotCtxs[spotIndex];
    if (!ctx) continue;

    const price = Number.parseFloat(ctx.markPx);
    const prevPrice = Number.parseFloat(ctx.prevDayPx || ctx.markPx);
    const priceChange = prevPrice > 0 ? (price - prevPrice) / prevPrice : 0;

    let futureCVD: "bullish" | "neutral" | "bearish" =
      priceChange > 0.005
        ? "bullish"
        : priceChange < -0.005
          ? "bearish"
          : "neutral";
    let cvdDelta = 0;

    try {
      const coinRef = `@${spotMeta.universe[spotIndex].index ?? spotIndex}`;
      const tradesRes = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "recentTrades", coin: coinRef }),
      });
      if (tradesRes.ok) {
        const tradesData = await tradesRes.json();
        const result = computeCVD(
          tradesData as Array<{ side: "B" | "A"; sz: string; px: string }>,
        );
        futureCVD = result.futureCVD;
        cvdDelta = result.cvdDelta;
      }
    } catch {
      // fallback CVD
    }

    return {
      price,
      oiDirection: "neutral",
      fundingLevel: "neutral",
      rawFunding: 0,
      rawOI: 0,
      futureCVD,
      cvdDelta,
      resolvedName: coinName,
    };
  }
  return null;
}

export async function fetchHyperliquidLiveData(
  coin: string,
): Promise<HyperliquidLiveData> {
  const candidates = getCandidates(coin);
  const originalInput = coin.split("/")[0].split("-")[0].trim().toUpperCase();
  const BASE_URL = "https://api.hyperliquid.xyz/info";

  try {
    // 1. Try xyz: candidates first (HIP-3 provider assets like xyz:SILVER)
    const xyzCandidates = candidates.filter((c) => c.startsWith("xyz:"));
    for (const xyzCandidate of xyzCandidates) {
      const xyzResult = await tryXyzLookup(xyzCandidate, BASE_URL);
      if (xyzResult) return xyzResult;
    }

    // 2. Try standard perp market
    const perpResult = await tryPerpLookup(candidates, BASE_URL);
    if (perpResult) return perpResult;

    // 3. Fallback: try spot market (HIP-3 non-xyz)
    const spotResult = await trySpotLookup(candidates, BASE_URL);
    if (spotResult) return spotResult;

    // 4. Not found
    const tried = candidates.join(", ");
    throw new Error(
      `Asset "${originalInput}" nicht auf Hyperliquid gefunden (versucht: ${tried}). Bitte Namen pr\u00fcfen oder Werte manuell eingeben.`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("nicht auf Hyperliquid") ||
        error.message.includes("nicht verf\u00fcgbar") ||
        error.message.includes("nicht gefunden") ||
        error.message.includes("versucht:"))
    ) {
      throw error;
    }
    throw new Error(
      "Hyperliquid API nicht erreichbar. Bitte Werte manuell eingeben.",
    );
  }
}
