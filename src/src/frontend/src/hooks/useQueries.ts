import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalysisSession,
  AssetStats,
  TradePosition,
  TradeSummary,
} from "../backend";
import type { AssetCategoryEnum, ExternalBlob } from "../backend";
import {
  calculateAssetStats,
  getAvailableAssets,
  getAvailableMetals,
  getAvailableStablecoins,
  getMetalPositions,
  getStablecoinPositions,
  isMetal,
  isStablecoin,
} from "../lib/tradeUtils";
import { useActor } from "./useActor";

export function useGetAllSessions() {
  const { actor, isFetching } = useActor();

  return useQuery<AnalysisSession[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllSessions();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetUserSessions(userPrincipal?: Principal) {
  const { actor, isFetching } = useActor();

  return useQuery<AnalysisSession[]>({
    queryKey: ["sessions", "user", userPrincipal?.toString()],
    queryFn: async () => {
      if (!actor || !userPrincipal) return [];
      return actor.getUserSessions(userPrincipal);
    },
    enabled: !!actor && !isFetching && !!userPrincipal,
  });
}

export function useGetSession(sessionId?: string) {
  const { actor, isFetching } = useActor();

  return useQuery<AnalysisSession | null>({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      if (!actor || !sessionId) return null;
      return actor.getSession(sessionId);
    },
    enabled: !!actor && !isFetching && !!sessionId,
  });
}

export function useStoreAnalysisSession() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      user,
      csvFile,
      positions,
      summary,
      timestamp,
    }: {
      sessionId: string;
      user: Principal;
      csvFile: ExternalBlob;
      positions: TradePosition[];
      summary: TradeSummary;
      timestamp: bigint;
    }) => {
      if (!actor) throw new Error("Actor not initialized");

      const availableAssets = getAvailableAssets(positions);
      const availableMetals = getAvailableMetals(positions);
      const availableStablecoins = getAvailableStablecoins(positions);

      const assetStats: AssetStats[] = availableAssets.map((asset) => {
        const stats = calculateAssetStats(positions, asset);
        const assetPositions = positions.filter((p) => p.symbol === asset);
        return {
          symbol: stats.symbol,
          totalPnl: stats.totalPnl,
          averagePnl: stats.averagePnl,
          tradeCount: BigInt(stats.tradeCount),
          positions: assetPositions,
        };
      });

      const metalsStats: AssetStats[] = availableMetals.map((metal) => {
        const stats = calculateAssetStats(positions, metal);
        const metalPositions = positions.filter((p) => p.symbol === metal);
        return {
          symbol: stats.symbol,
          totalPnl: stats.totalPnl,
          averagePnl: stats.averagePnl,
          tradeCount: BigInt(stats.tradeCount),
          positions: metalPositions,
        };
      });

      const cryptoAssets = availableAssets.filter(
        (asset) => !isMetal(asset) && !isStablecoin(asset),
      );
      const cryptoStats: AssetStats[] = cryptoAssets.map((crypto) => {
        const stats = calculateAssetStats(positions, crypto);
        const cryptoPositions = positions.filter((p) => p.symbol === crypto);
        return {
          symbol: stats.symbol,
          totalPnl: stats.totalPnl,
          averagePnl: stats.averagePnl,
          tradeCount: BigInt(stats.tradeCount),
          positions: cryptoPositions,
        };
      });

      const stablecoinStats: AssetStats[] = availableStablecoins.map(
        (stablecoin) => {
          const stats = calculateAssetStats(positions, stablecoin);
          const stablecoinPositions = positions.filter(
            (p) => p.symbol === stablecoin,
          );
          return {
            symbol: stats.symbol,
            totalPnl: stats.totalPnl,
            averagePnl: stats.averagePnl,
            tradeCount: BigInt(stats.tradeCount),
            positions: stablecoinPositions,
          };
        },
      );

      return actor.storeAnalysisSession(
        sessionId,
        user,
        csvFile,
        positions,
        summary,
        assetStats,
        metalsStats,
        cryptoStats,
        stablecoinStats,
        availableAssets,
        availableMetals,
        availableStablecoins,
        timestamp,
        null, // feeOverview - not calculated on frontend, backend will handle if needed
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.deleteSession(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useGetAssetStats(
  sessionId?: string,
  assetCategory?: AssetCategoryEnum | null,
) {
  const { actor, isFetching } = useActor();

  return useQuery<[AssetStats[], AssetStats[]]>({
    queryKey: ["session", sessionId, "assetStats", assetCategory],
    queryFn: async () => {
      if (!actor || !sessionId) return [[], []];
      return actor.getAssetStats(sessionId, assetCategory || null);
    },
    enabled: !!actor && !isFetching && !!sessionId,
  });
}

export function useGetSessionAvailableAssets(sessionId?: string) {
  const { actor, isFetching } = useActor();

  return useQuery<string[]>({
    queryKey: ["session", sessionId, "assets"],
    queryFn: async () => {
      if (!actor || !sessionId) return [];
      return actor.getSessionAvailableAssets(sessionId);
    },
    enabled: !!actor && !isFetching && !!sessionId,
  });
}

export function useGetAllMetals() {
  const { actor, isFetching } = useActor();

  return useQuery<string[]>({
    queryKey: ["metals"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllMetals();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAllStablecoins() {
  const { actor, isFetching } = useActor();

  return useQuery<string[]>({
    queryKey: ["stablecoins"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllStablecoins();
    },
    enabled: !!actor && !isFetching,
  });
}
