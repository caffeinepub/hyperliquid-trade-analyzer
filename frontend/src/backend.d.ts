import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface TradeSummary {
    averageRiskLevel: RiskLevel;
    liquidatedPositions: bigint;
    totalMetalsPnl: number;
    totalPnl: number;
    totalMargin: number;
    totalPositions: bigint;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface FeeDirectionAnalysis {
    direction: TradeDirectionEnum;
    tradeCount: bigint;
    percentageOfTotal: number;
    totalFees: number;
}
export type Principal = Principal;
export interface FeeOverview {
    feesByDirection: Array<FeeDirectionAnalysis>;
    topTradesByFee: Array<TopTradeByFee>;
    recommendations: Array<string>;
    totalFees: number;
    averageFee: number;
    feesByCategory: Array<FeeCategoryAnalysis>;
    feesByAsset: Array<FeeAssetAnalysis>;
}
export interface AnalysisSession {
    availableStablecoins: Array<string>;
    csvFile: ExternalBlob;
    assetStats: Array<AssetStats>;
    user: Principal;
    availableMetals: Array<string>;
    stablecoinStats: Array<AssetStats>;
    summary: TradeSummary;
    cryptoStats: Array<AssetStats>;
    feeOverview?: FeeOverview;
    availableAssets: Array<string>;
    metalsStats: Array<AssetStats>;
    timestamp: bigint;
    sessionId: string;
    positions: Array<TradePosition>;
}
export interface http_header {
    value: string;
    name: string;
}
export interface TradePosition {
    fee: number;
    status: PositionStatus;
    direction: TradeDirectionEnum;
    leverage?: number;
    user: string;
    positionSize: number;
    isLiquidated: boolean;
    liquidationPrice?: number;
    tradeId: string;
    marginUsed: number;
    realizedPnl: number;
    entryPrice: number;
    unrealizedPnl: number;
    assetCategory: AssetCategoryEnum;
    riskLevel: RiskLevel;
    symbol: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface FeeAssetAnalysis {
    asset: string;
    tradeCount: bigint;
    percentageOfTotal: number;
    totalFees: number;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface FeeCategoryAnalysis {
    categoryName: string;
    tradeCount: bigint;
    percentageOfTotal: number;
    totalFees: number;
}
export interface AssetStats {
    tradeCount: bigint;
    totalPnl: number;
    averagePnl: number;
    positions: Array<TradePosition>;
    symbol: string;
}
export interface TopTradeByFee {
    feeAmount: number;
    context: string;
    asset: string;
    tradeId: string;
}
export enum AssetCategoryEnum {
    metal = "metal",
    stablecoin = "stablecoin",
    other = "other",
    crypto = "crypto",
    commodity = "commodity"
}
export enum PositionStatus {
    pending = "pending",
    safe = "safe",
    liquidated = "liquidated",
    atRisk = "atRisk"
}
export enum RiskLevel {
    low = "low",
    high = "high",
    extreme = "extreme",
    medium = "medium"
}
export enum TradeDirectionEnum {
    long_ = "long",
    short_ = "short"
}
export interface backendInterface {
    calculateDynamicLeverage(_stablecoin: string, _assetCategory: AssetCategoryEnum | null, entryPrice: number, positionSize: number, marginUsed: number | null, ntl: number | null, fee: number | null): Promise<number | null>;
    deleteSession(sessionId: string): Promise<void>;
    getAllMetals(): Promise<Array<string>>;
    getAllSessions(): Promise<Array<AnalysisSession>>;
    getAllStablecoins(): Promise<Array<string>>;
    getAssetStats(sessionId: string, assetCategory: AssetCategoryEnum | null): Promise<[Array<AssetStats>, Array<AssetStats>]>;
    getAverageInterestRates(_asset: string): Promise<{
        averageWeeklyRate: number;
        averageDailyRate: number;
        averageMonthlyRate: number;
    } | null>;
    getCryptoLeverage(_crypto: string): Promise<number>;
    getDefaultCryptoLeverage(): Promise<number>;
    getDefaultLeverage(assetCategory: AssetCategoryEnum): Promise<number>;
    getDefaultMetalsLeverage(): Promise<number>;
    getDefaultStablecoinLeverage(): Promise<number>;
    getFeeOverview(sessionId: string): Promise<FeeOverview | null>;
    getHyperliquidOrderBook(symbol: string): Promise<string | null>;
    getKursDeviation(_metal: string): Promise<{
        deviation: number;
        sellPrice: number;
        buyPrice: number;
    } | null>;
    getLegacyClosestLeverage(_asset: string, leverage: number, _assetCategory: AssetCategoryEnum): Promise<number>;
    getLegacyUniqueTradeSymbols(): Promise<Array<string>>;
    getLeverageStats(_asset: string, _assetCategory: AssetCategoryEnum): Promise<{
        defaultLeverage: number;
        minLeverage: number;
        maxLeverage: number;
        mostFrequentLeverage: number;
    }>;
    getMetalLeverage(_metal: string): Promise<number>;
    getSession(sessionId: string): Promise<AnalysisSession>;
    getSessionAvailableAssets(sessionId: string): Promise<Array<string>>;
    getStablecoinLeverage(_stablecoin: string): Promise<number>;
    getUserSessions(user: Principal): Promise<Array<AnalysisSession>>;
    storeAnalysisSession(sessionId: string, user: Principal, csvFile: ExternalBlob, positions: Array<TradePosition>, summary: TradeSummary, assetStats: Array<AssetStats>, metalsStats: Array<AssetStats>, cryptoStats: Array<AssetStats>, stablecoinStats: Array<AssetStats>, availableAssets: Array<string>, availableMetals: Array<string>, availableStablecoins: Array<string>, timestamp: bigint, feeOverview: FeeOverview | null): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
