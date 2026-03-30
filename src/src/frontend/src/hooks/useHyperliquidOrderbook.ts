import { useCallback, useEffect, useRef, useState } from "react";
import { useActor } from "./useActor";

interface OrderbookLevel {
  price: number;
  size: number;
}

interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  midPrice: number;
}

interface UseHyperliquidOrderbookOptions {
  symbol: string;
  depth: number;
  interval: number;
  paused: boolean;
}

interface UseHyperliquidOrderbookReturn {
  orderbook: Orderbook | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refetch: () => void;
}

export function useHyperliquidOrderbook({
  symbol,
  depth,
  interval,
  paused,
}: UseHyperliquidOrderbookOptions): UseHyperliquidOrderbookReturn {
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const { actor } = useActor();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchOrderbook = useCallback(async () => {
    if (!isMountedRef.current || paused) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try direct fetch first
      let data: any = null;
      let _usedBackend = false;

      try {
        const response = await fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "l2Book",
            coin: symbol,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        data = await response.json();
      } catch (fetchError) {
        console.warn(
          "[useHyperliquidOrderbook] Direct fetch failed, trying backend fallback:",
          fetchError,
        );

        // Fallback to backend
        if (actor) {
          try {
            const backendResult = await actor.getHyperliquidOrderBook(symbol);
            if (backendResult) {
              data = JSON.parse(backendResult);
              _usedBackend = true;
            }
          } catch (backendError) {
            console.error(
              "[useHyperliquidOrderbook] Backend fallback failed:",
              backendError,
            );
            throw new Error(
              "Failed to fetch orderbook from both direct API and backend",
            );
          }
        } else {
          throw new Error(
            "Direct fetch failed and backend actor not available",
          );
        }
      }

      if (!data || !data.levels) {
        throw new Error("Invalid orderbook data received");
      }

      // Parse the orderbook data
      const bids: OrderbookLevel[] = data.levels[0]
        .slice(0, depth)
        .map((level: any) => ({
          price: Number.parseFloat(level.px),
          size: Number.parseFloat(level.sz),
        }));

      const asks: OrderbookLevel[] = data.levels[1]
        .slice(0, depth)
        .map((level: any) => ({
          price: Number.parseFloat(level.px),
          size: Number.parseFloat(level.sz),
        }));

      // Calculate mid price
      const bestBid = bids.length > 0 ? bids[0].price : 0;
      const bestAsk = asks.length > 0 ? asks[0].price : 0;
      const midPrice = (bestBid + bestAsk) / 2;

      if (isMountedRef.current) {
        setOrderbook({ bids, asks, midPrice });
        setLastUpdated(Date.now());
        setError(null);
      }
    } catch (err) {
      console.error("[useHyperliquidOrderbook] Error fetching orderbook:", err);
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch orderbook",
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [symbol, depth, paused, actor]);

  // Initial fetch
  useEffect(() => {
    fetchOrderbook();
  }, [fetchOrderbook]);

  // Set up polling interval
  useEffect(() => {
    if (paused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      fetchOrderbook();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [interval, paused, fetchOrderbook]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const refetch = useCallback(() => {
    fetchOrderbook();
  }, [fetchOrderbook]);

  return {
    orderbook,
    isLoading,
    error,
    lastUpdated,
    refetch,
  };
}
