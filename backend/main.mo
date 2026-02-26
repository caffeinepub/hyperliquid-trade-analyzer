import Text "mo:core/Text";
import List "mo:core/List";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Set "mo:core/Set";
import Nat "mo:core/Nat";
import Float "mo:core/Float";
import Iter "mo:core/Iter";
import OutCall "http-outcalls/outcall";
import Storage "blob-storage/Storage";
import MixinStorage "blob-storage/Mixin";

actor {
  include MixinStorage();

  type TradePosition = {
    tradeId : Text;
    user : Text;
    symbol : Text;
    positionSize : Float;
    entryPrice : Float;
    liquidationPrice : ?Float;
    realizedPnl : Float;
    unrealizedPnl : Float;
    marginUsed : Float;
    isLiquidated : Bool;
    status : PositionStatus;
    riskLevel : RiskLevel;
    assetCategory : AssetCategoryEnum;
    direction : TradeDirectionEnum;
    leverage : ?Float;
    fee : Float;
  };

  type PositionStatus = {
    #safe;
    #atRisk;
    #liquidated;
    #pending;
  };

  type Metal = {
    name : Text;
    symbol : Text;
    currentPrice : Float;
    unit : Text;
  };

  type RiskLevel = {
    #low;
    #medium;
    #high;
    #extreme;
  };

  type TradeSummary = {
    totalPositions : Nat;
    liquidatedPositions : Nat;
    totalPnl : Float;
    totalMargin : Float;
    averageRiskLevel : RiskLevel;
    totalMetalsPnl : Float;
  };

  type AssetStats = {
    symbol : Text;
    totalPnl : Float;
    averagePnl : Float;
    tradeCount : Nat;
    positions : [TradePosition];
  };

  type RealizedPnl = Float;

  type AssetCategoryEnum = {
    #crypto;
    #metal;
    #commodity;
    #stablecoin;
    #other;
  };

  type TradeDirectionEnum = {
    #long;
    #short;
  };

  type FeeCategoryAnalysis = {
    categoryName : Text;
    totalFees : Float;
    tradeCount : Nat;
    percentageOfTotal : Float;
  };

  type FeeAssetAnalysis = {
    asset : Text;
    totalFees : Float;
    tradeCount : Nat;
    percentageOfTotal : Float;
  };

  type FeeDirectionAnalysis = {
    direction : TradeDirectionEnum;
    totalFees : Float;
    tradeCount : Nat;
    percentageOfTotal : Float;
  };

  type TopTradeByFee = {
    tradeId : Text;
    asset : Text;
    feeAmount : Float;
    context : Text;
  };

  type FeeOverview = {
    totalFees : Float;
    averageFee : Float;
    feesByCategory : [FeeCategoryAnalysis];
    feesByAsset : [FeeAssetAnalysis];
    feesByDirection : [FeeDirectionAnalysis];
    topTradesByFee : [TopTradeByFee];
    recommendations : [Text];
  };

  type AnalysisSession = {
    sessionId : Text;
    user : Principal.Principal;
    csvFile : Storage.ExternalBlob;
    positions : [TradePosition];
    summary : TradeSummary;
    assetStats : [AssetStats];
    metalsStats : [AssetStats];
    cryptoStats : [AssetStats];
    stablecoinStats : [AssetStats];
    availableAssets : [Text];
    availableMetals : [Text];
    availableStablecoins : [Text];
    timestamp : Int;
    feeOverview : ?FeeOverview;
  };

  func calculateTotalMetalsPnl(positions : [TradePosition]) : RealizedPnl {
    var totalPnl = 0.0;
    for (position in positions.values()) {
      switch (position.assetCategory) {
        case (#metal) {
          totalPnl += position.realizedPnl + position.unrealizedPnl;
        };
        case (_) {};
      };
    };
    totalPnl;
  };

  let analysisSessions = Map.empty<Text, AnalysisSession>();

  public shared ({ caller }) func storeAnalysisSession(
    sessionId : Text,
    user : Principal.Principal,
    csvFile : Storage.ExternalBlob,
    positions : [TradePosition],
    summary : TradeSummary,
    assetStats : [AssetStats],
    metalsStats : [AssetStats],
    cryptoStats : [AssetStats],
    stablecoinStats : [AssetStats],
    availableAssets : [Text],
    availableMetals : [Text],
    availableStablecoins : [Text],
    timestamp : Int,
    feeOverview : ?FeeOverview,
  ) : async () {
    let updatedPositions = positions.map(func(p) { { p with leverage = p.leverage } });
    let updatedAssetStats = assetStats.map(func(a) { { a with positions = a.positions.map(func(p) { { p with leverage = p.leverage } }) } });
    let updatedMetals = metalsStats.map(func(a) { { a with positions = a.positions.map(func(p) { { p with leverage = p.leverage } }) } });
    let updatedCrypto = cryptoStats.map(func(a) { { a with positions = a.positions.map(func(p) { { p with leverage = p.leverage } }) } });
    let updatedStablecoins = stablecoinStats.map(func(a) { { a with positions = a.positions.map(func(p) { { p with leverage = p.leverage } }) } });

    let newSession : AnalysisSession = {
      sessionId;
      user;
      csvFile;
      positions = updatedPositions;
      summary;
      assetStats = updatedAssetStats;
      metalsStats = updatedMetals;
      cryptoStats = updatedCrypto;
      stablecoinStats = updatedStablecoins;
      availableAssets;
      availableMetals;
      availableStablecoins;
      timestamp;
      feeOverview;
    };
    analysisSessions.add(sessionId, newSession);
  };

  public query ({ caller }) func getSession(sessionId : Text) : async AnalysisSession {
    switch (analysisSessions.get(sessionId)) {
      case (null) { Runtime.trap("Session not found") };
      case (?session) { session };
    };
  };

  public query ({ caller }) func getAllSessions() : async [AnalysisSession] {
    analysisSessions.values().toArray();
  };

  public query ({ caller }) func getUserSessions(user : Principal.Principal) : async [AnalysisSession] {
    let userSessions = List.empty<AnalysisSession>();
    for (session in analysisSessions.values()) {
      if (session.user == user) {
        userSessions.add(session);
      };
    };
    userSessions.toArray();
  };

  public query ({ caller }) func getAssetStats(sessionId : Text, assetCategory : ?AssetCategoryEnum) : async ([AssetStats], [AssetStats]) {
    let session = switch (analysisSessions.get(sessionId)) {
      case (null) { Runtime.trap("Session not found") };
      case (?session) { session };
    };

    switch (assetCategory) {
      case (null) { (session.assetStats, session.assetStats) };
      case (?category) {
        switch (category) {
          case (#metal) { (session.metalsStats, session.assetStats) };
          case (#crypto) { (session.cryptoStats, session.assetStats) };
          case (#stablecoin) { (session.stablecoinStats, session.assetStats) };
          case (_) { (session.assetStats, session.assetStats) };
        };
      };
    };
  };

  public query ({ caller }) func getSessionAvailableAssets(sessionId : Text) : async [Text] {
    let session = switch (analysisSessions.get(sessionId)) {
      case (null) { Runtime.trap("Session not found") };
      case (?session) { session };
    };
    session.availableAssets;
  };

  public query ({ caller }) func getAllMetals() : async [Text] {
    ["Silber", "Gold", "Kupfer"];
  };

  public query ({ caller }) func getAllStablecoins() : async [Text] {
    ["USDC", "USDE", "USDH"];
  };

  public shared ({ caller }) func deleteSession(sessionId : Text) : async () {
    if (not analysisSessions.containsKey(sessionId)) {
      Runtime.trap("Session not found");
    };
    analysisSessions.remove(sessionId);
  };

  public query ({ caller }) func getDefaultStablecoinLeverage() : async Float {
    1.0;
  };

  public query ({ caller }) func getDefaultMetalsLeverage() : async Float {
    100.0;
  };

  public query ({ caller }) func getDefaultCryptoLeverage() : async Float {
    50.0;
  };

  public shared ({ caller }) func getStablecoinLeverage(_stablecoin : Text) : async Float {
    1.0;
  };

  public shared ({ caller }) func getMetalLeverage(_metal : Text) : async Float {
    100.0;
  };

  public shared ({ caller }) func getCryptoLeverage(_crypto : Text) : async Float {
    50.0;
  };

  public query ({ caller }) func getDefaultLeverage(assetCategory : AssetCategoryEnum) : async Float {
    switch (assetCategory) {
      case (#stablecoin) { 1.0 };
      case (#metal) { 100.0 };
      case (#crypto) { 50.0 };
      case (_) { 10.0 };
    };
  };

  public query ({ caller }) func getLegacyClosestLeverage(_asset : Text, leverage : Float, _assetCategory : AssetCategoryEnum) : async Float {
    let leverageTiers = [
      1.0, 2.0, 4.0, 5.0, 10.0, 20.0, 25.0, 30.0, 50.0, 100.0, 125.0,
    ];

    var closest = 1.0;
    var smallestDiff = 1000.0;
    for (tier in leverageTiers.values()) {
      let diff = absFloat(leverage - tier);
      if (diff < smallestDiff) {
        smallestDiff := diff;
        closest := tier;
      };
    };
    closest;
  };

  func absFloat(x : Float) : Float {
    if (x < 0.0) { -x } else { x };
  };

  public shared ({ caller }) func calculateDynamicLeverage(
    _stablecoin : Text,
    _assetCategory : ?AssetCategoryEnum,
    entryPrice : Float,
    positionSize : Float,
    marginUsed : ?Float,
    ntl : ?Float,
    fee : ?Float,
  ) : async ?Float {
    // Check if marginUsed is provided and greater than 0
    switch (marginUsed) {
      case (?margin) {
        if (margin > 0) {
          return ?roundToTwoDecimals(entryPrice * positionSize / margin);
        };
      };
      case (_) {};
    };

    // If marginUsed is not available, try using ntl
    switch (ntl) {
      case (?n) {
        if (n > 0) {
          return ?roundToTwoDecimals(n / (entryPrice * positionSize));
        };
      };
      case (_) {};
    };

    // If both marginUsed and ntl are not available, try using fee
    switch (fee) {
      case (?f) {
        if (f > 0) {
          return ?roundToTwoDecimals(entryPrice * positionSize / (f + 0.0001));
        };
      };
      case (_) {};
    };

    // If all else fails, return null
    null;
  };

  func roundToTwoDecimals(value : Float) : Float {
    let scaledValue = value * 100.0;
    let scaledValueToInt = if (scaledValue >= 0) {
      scaledValue + 0.5;
    } else {
      scaledValue - 0.5;
    };
    scaledValueToInt / 100.0;
  };

  public query ({ caller }) func getLeverageStats(_asset : Text, _assetCategory : AssetCategoryEnum) : async {
    minLeverage : Float;
    maxLeverage : Float;
    mostFrequentLeverage : Float;
    defaultLeverage : Float;
  } {
    {
      minLeverage = 1.0;
      maxLeverage = if (_assetCategory == #metal) { 100.0 } else if (_assetCategory == #crypto) { 50.0 } else { 10.0 };
      mostFrequentLeverage = 10.0;
      defaultLeverage = switch (_assetCategory) {
        case (#stablecoin) { 1.0 };
        case (#metal) { 100.0 };
        case (#crypto) { 50.0 };
        case (_) { 10.0 };
      };
    };
  };

  public query ({ caller }) func getKursDeviation(_metal : Text) : async ?{
    buyPrice : Float;
    sellPrice : Float;
    deviation : Float;
  } {
    ?{
      buyPrice = 0.0;
      sellPrice = 0.0;
      deviation = 0.011;
    };
  };

  public query ({ caller }) func getAverageInterestRates(_asset : Text) : async ?{
    averageDailyRate : Float;
    averageWeeklyRate : Float;
    averageMonthlyRate : Float;
  } {
    ?{
      averageDailyRate = 0.0005;
      averageWeeklyRate = 0.0035;
      averageMonthlyRate = 0.015;
    };
  };

  public query ({ caller }) func getFeeOverview(sessionId : Text) : async ?FeeOverview {
    switch (analysisSessions.get(sessionId)) {
      case (null) { Runtime.trap("Session not found") };
      case (?session) { session.feeOverview };
    };
  };

  public query ({ caller }) func getLegacyUniqueTradeSymbols() : async [Text] {
    let uniqueSymbolsSet = Set.empty<Text>();
    for ((_, session) in analysisSessions.entries()) {
      for (position in session.positions.values()) {
        uniqueSymbolsSet.add(position.symbol);
      };
    };
    uniqueSymbolsSet.toArray();
  };

  public query ({ caller }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public shared ({ caller }) func getHyperliquidOrderBook(symbol : Text) : async ?Text {
    let url = "https://api.hyperliquid.xyz/ob_snapshot?symbol=" # symbol;
    try {
      let result = await OutCall.httpGetRequest(url, [], transform);
      ?result;
    } catch (e) {
      null;
    };
  };
};
