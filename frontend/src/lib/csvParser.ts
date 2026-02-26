import { RiskLevel, PositionStatus, AssetCategoryEnum, TradeDirectionEnum } from '../backend';
import type { TradePosition, TradeSummary } from '../backend';
import { isMetal, isStablecoin, getMetalPositions, getStablecoinPositions } from './utils';

interface CSVRow {
  [key: string]: string;
}

// German to English column name mappings
const GERMAN_COLUMN_MAPPINGS: Record<string, string> = {
  'einstiegspreis': 'entry price',
  'eintrittspreis': 'entry price',
  'entry': 'entry price',
  'positionsgröße': 'position size',
  'positionsgroesse': 'position size',
  'größe': 'position size',
  'groesse': 'position size',
  'size': 'position size',
  'positionsize': 'position size',
  'liquidationspreis': 'liquidation price',
  'liq preis': 'liquidation price',
  'liq. preis': 'liquidation price',
  'liquidationprice': 'liquidation price',
  'gewinn/verlust': 'realized pnl',
  'gewinn': 'realized pnl',
  'verlust': 'realized pnl',
  'realisierter pnl': 'realized pnl',
  'realisierter gewinn': 'realized pnl',
  'rpnl': 'realized pnl',
  'realizedpnl': 'realized pnl',
  'unrealisierter pnl': 'unrealized pnl',
  'unrealisierter gewinn': 'unrealized pnl',
  'upnl': 'unrealized pnl',
  'unrealizedpnl': 'unrealized pnl',
  'verwendete margin': 'margin used',
  'margin': 'margin used',
  'marginused': 'margin used',
  'hebel': 'leverage',
  'leverage': 'leverage',
  'lev': 'leverage',
  'status': 'status',
  'symbol': 'symbol',
  'handelspaar': 'symbol',
  'pair': 'symbol',
  'asset': 'symbol',
  'trade id': 'trade id',
  'position id': 'trade id',
  'id': 'trade id',
  'tradeid': 'trade id',
  'benutzer': 'user',
  'händler': 'user',
  'trader': 'user',
  'user': 'user',
  // Hyperliquid-specific mappings
  'coin': 'symbol',
  'px': 'entry price',
  'sz': 'position size',
  'ntl': 'notional',
  'fee': 'fee',
  'closedpnl': 'realized pnl',
  'dir': 'direction',
  'side': 'side',
  'time': 'time',
  'hash': 'hash',
  'tid': 'trade id',
  'oid': 'order id'
};

// Trading action keywords that indicate a headerless CSV or direction values
const TRADING_ACTIONS = [
  'open long', 'open short', 'close long', 'close short',
  'long öffnen', 'short öffnen', 'long schließen', 'short schließen',
  'buy', 'sell', 'kaufen', 'verkaufen',
  'long', 'short',
  'liquidated', 'liquidiert',
  'liquidated isolated long', 'liquidated isolated short',
  'liquidated cross long', 'liquidated cross short'
];

// Dev mode detection
const isDev = import.meta.env.DEV;

/**
 * Detects if the first row contains trading actions instead of headers
 */
function isHeaderlessCSV(firstRowValues: string[]): boolean {
  // Check if any value in the first row matches trading action keywords
  for (const value of firstRowValues) {
    const normalized = value.toLowerCase().trim();
    for (const action of TRADING_ACTIONS) {
      if (normalized.includes(action)) {
        if (isDev) console.log(`[CSV Parser] Headerlose CSV erkannt: "${value}" enthält Trading-Aktion "${action}"`);
        return true;
      }
    }
  }
  return false;
}

/**
 * Analyzes column content to determine its type based on patterns
 */
function analyzeColumnType(values: string[]): string {
  const samples = values.slice(0, 50).filter(v => v && v.trim() !== '' && v.trim() !== '-');
  
  if (samples.length === 0) return 'unknown';

  // Check for symbol patterns (e.g., BTC-USD, ETHUSD, BTC/USD, BTC, ETH)
  const symbolPattern = /^[A-Z]{2,10}[-/]?[A-Z]{0,10}$/i;
  const symbolMatches = samples.filter(v => symbolPattern.test(v.trim())).length;
  if (symbolMatches / samples.length > 0.7) {
    return 'symbol';
  }

  // Check for trading actions and directions
  const actionMatches = samples.filter(v => {
    const normalized = v.toLowerCase().trim();
    return TRADING_ACTIONS.some(action => normalized.includes(action));
  }).length;
  if (actionMatches / samples.length > 0.5) {
    return 'direction';
  }

  // Check for side indicators (B/A for Buy/Ask)
  const sidePattern = /^[BA]$/i;
  const sideMatches = samples.filter(v => sidePattern.test(v.trim())).length;
  if (sideMatches / samples.length > 0.8) {
    return 'side';
  }

  // Check for hash patterns (0x followed by hex)
  const hashPattern = /^0x[0-9a-f]{40,}$/i;
  const hashMatches = samples.filter(v => hashPattern.test(v.trim())).length;
  if (hashMatches / samples.length > 0.7) {
    return 'hash';
  }

  // Check for timestamp patterns (Unix timestamp)
  const timestampPattern = /^\d{10,13}$/;
  const timestampMatches = samples.filter(v => timestampPattern.test(v.trim())).length;
  if (timestampMatches / samples.length > 0.7) {
    return 'timestamp';
  }

  // Check for date/time patterns (DD.MM.YYYY - HH:MM:SS or similar)
  const dateTimePattern = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}[\s-]+\d{1,2}:\d{2}(:\d{2})?$/;
  const dateTimeMatches = samples.filter(v => dateTimePattern.test(v.trim())).length;
  if (dateTimeMatches / samples.length > 0.7) {
    return 'datetime';
  }

  // Check for numeric patterns
  const numericPattern = /^-?[\d\s.,]+$/;
  const numericMatches = samples.filter(v => numericPattern.test(v.trim())).length;
  
  if (numericMatches / samples.length > 0.8) {
    // Analyze numeric characteristics
    const avgValue = samples.reduce((sum, v) => {
      const num = parseFloat(v.replace(/[^\d.-]/g, ''));
      return sum + (isNaN(num) ? 0 : Math.abs(num));
    }, 0) / samples.length;

    const hasDecimals = samples.some(v => v.includes('.') || v.includes(','));
    const hasLargeValues = avgValue > 1000;
    const hasSmallValues = avgValue < 10 && avgValue > 0;

    // Leverage is typically 1-100
    if (hasSmallValues && avgValue < 100) {
      return 'leverage';
    }

    // Position size and prices are typically larger
    if (hasLargeValues) {
      // Check if values look like prices (more decimal precision)
      const decimalPlaces = samples.map(v => {
        const match = v.match(/[.,](\d+)$/);
        return match ? match[1].length : 0;
      });
      const avgDecimals = decimalPlaces.reduce((a, b) => a + b, 0) / decimalPlaces.length;
      
      if (avgDecimals >= 2) {
        return 'price';
      }
      return 'size';
    }

    // PnL can be positive or negative
    const hasNegative = samples.some(v => v.trim().startsWith('-'));
    if (hasNegative) {
      return 'pnl';
    }

    return 'numeric';
  }

  // Check for status keywords
  const statusKeywords = ['safe', 'sicher', 'risk', 'risiko', 'liquidated', 'liquidiert', 'pending', 'ausstehend'];
  const statusMatches = samples.filter(v => {
    const normalized = v.toLowerCase().trim();
    return statusKeywords.some(kw => normalized.includes(kw));
  }).length;
  if (statusMatches / samples.length > 0.5) {
    return 'status';
  }

  return 'text';
}

/**
 * Maps columns dynamically based on content analysis
 */
function mapColumnsDynamically(rows: string[][]): string[] {
  if (rows.length === 0) return [];

  const columnCount = rows[0].length;
  const columnTypes: string[] = [];

  if (isDev) console.log('[CSV Parser] Analysiere Spaltentypen dynamisch...');

  // Analyze each column
  for (let colIndex = 0; colIndex < columnCount; colIndex++) {
    const columnValues = rows.map(row => row[colIndex] || '');
    const type = analyzeColumnType(columnValues);
    columnTypes.push(type);
    
    if (isDev) console.log(`[CSV Parser] Spalte ${colIndex}: Typ "${type}"`);
  }

  // Map types to field names
  const headers: string[] = [];
  const usedTypes = new Set<string>();

  for (let i = 0; i < columnTypes.length; i++) {
    const type = columnTypes[i];
    
    switch (type) {
      case 'symbol':
        headers.push('symbol');
        break;
      case 'direction':
        headers.push('direction');
        break;
      case 'side':
        headers.push('side');
        break;
      case 'hash':
        headers.push('hash');
        break;
      case 'timestamp':
      case 'datetime':
        headers.push('time');
        break;
      case 'leverage':
        headers.push('leverage');
        break;
      case 'price':
        // First price column is entry, second is liquidation
        if (!usedTypes.has('entry price')) {
          headers.push('entry price');
          usedTypes.add('entry price');
        } else if (!usedTypes.has('liquidation price')) {
          headers.push('liquidation price');
          usedTypes.add('liquidation price');
        } else {
          headers.push('price');
        }
        break;
      case 'size':
        headers.push('position size');
        break;
      case 'pnl':
        // First PnL is realized, second is unrealized
        if (!usedTypes.has('realized pnl')) {
          headers.push('realized pnl');
          usedTypes.add('realized pnl');
        } else if (!usedTypes.has('unrealized pnl')) {
          headers.push('unrealized pnl');
          usedTypes.add('unrealized pnl');
        } else {
          headers.push('pnl');
        }
        break;
      case 'numeric':
        // Try to infer from position
        if (!usedTypes.has('margin used')) {
          headers.push('margin used');
          usedTypes.add('margin used');
        } else if (!usedTypes.has('fee')) {
          headers.push('fee');
          usedTypes.add('fee');
        } else if (!usedTypes.has('notional')) {
          headers.push('notional');
          usedTypes.add('notional');
        } else {
          headers.push(`numeric_${i}`);
        }
        break;
      case 'status':
        headers.push('status');
        break;
      case 'text':
        // First text column might be user/trader
        if (!usedTypes.has('user')) {
          headers.push('user');
          usedTypes.add('user');
        } else {
          headers.push(`text_${i}`);
        }
        break;
      default:
        headers.push(`col_${i}`);
    }
  }

  if (isDev) console.log('[CSV Parser] Dynamisch gemappte Spalten:', headers);

  return headers;
}

/**
 * Detects the number format used in a column by statistical sampling
 * Returns 'de' for German format (comma as decimal) or 'en' for English format (dot as decimal)
 */
function detectNumberFormat(values: string[]): 'de' | 'en' {
  let commaAsDecimalCount = 0;
  let dotAsDecimalCount = 0;
  let samplesAnalyzed = 0;

  for (const value of values) {
    if (!value || value.trim() === '' || value.trim() === '-') continue;

    const cleaned = value.trim()
      .replace(/\s+/g, '')
      .replace(/[$€£¥]/g, '')
      .replace(/[^\d.,-]/g, '');

    if (!cleaned || cleaned === '-') continue;

    const commaCount = (cleaned.match(/,/g) || []).length;
    const dotCount = (cleaned.match(/\./g) || []).length;

    // Skip if no separators
    if (commaCount === 0 && dotCount === 0) continue;

    samplesAnalyzed++;

    // If both separators present, the last one is the decimal separator
    if (commaCount > 0 && dotCount > 0) {
      const lastCommaPos = cleaned.lastIndexOf(',');
      const lastDotPos = cleaned.lastIndexOf('.');
      
      if (lastCommaPos > lastDotPos) {
        commaAsDecimalCount++;
      } else {
        dotAsDecimalCount++;
      }
    } else if (commaCount === 1) {
      // Single comma - check if it's likely a decimal separator
      const parts = cleaned.split(',');
      if (parts[1] && parts[1].length <= 8) {
        commaAsDecimalCount++;
      }
    } else if (dotCount === 1) {
      // Single dot - check if it's likely a decimal separator
      const parts = cleaned.split('.');
      if (parts[1] && parts[1].length <= 8) {
        dotAsDecimalCount++;
      }
    } else if (commaCount > 1) {
      // Multiple commas suggest English thousand separators
      dotAsDecimalCount++;
    } else if (dotCount > 1) {
      // Multiple dots suggest German thousand separators
      commaAsDecimalCount++;
    }

    // Stop after analyzing enough samples
    if (samplesAnalyzed >= 20) break;
  }

  // Default to English (dot as decimal) if no clear pattern
  if (samplesAnalyzed === 0) {
    if (isDev) console.log('[CSV Parser] Keine Zahlenformate erkannt, verwende Standardformat: Englisch (Punkt als Dezimal)');
    return 'en';
  }

  const format = commaAsDecimalCount > dotAsDecimalCount ? 'de' : 'en';
  if (isDev) {
    console.log(`[CSV Parser] Zahlenformat erkannt: ${format === 'de' ? 'Deutsch (Komma als Dezimaltrennzeichen)' : 'Englisch (Punkt als Dezimaltrennzeichen)'}`);
    console.log(`[CSV Parser] Analysierte Samples: ${samplesAnalyzed}, Komma als Dezimal: ${commaAsDecimalCount}, Punkt als Dezimal: ${dotAsDecimalCount}`);
  }

  return format;
}

/**
 * Normalizes number formats from both German and English CSV formats
 * Returns a valid float or 0 if parsing fails
 * Ensures period is used as decimal separator for proper float parsing
 */
function normalizeNumber(value: string, fieldName: string = '', detectedFormat: 'de' | 'en' = 'en'): number {
  // Handle empty or dash-only values
  if (!value || value.trim() === '' || value.trim() === '-' || value.trim() === '–') {
    if (isDev && fieldName) {
      console.log(`[CSV Parser] Leeres Feld '${fieldName}': "${value}" -> 0`);
    }
    return 0;
  }

  // Remove whitespace, currency symbols, and special characters
  let normalized = value.trim()
    .replace(/\s+/g, '')
    .replace(/[$€£¥]/g, '')
    .replace(/–/g, '-')
    .replace(/[^\d.,-]/g, '');

  if (normalized === '' || normalized === '-') {
    if (isDev) console.log(`[CSV Parser] Ungültiger Wert für '${fieldName}': "${value}" -> 0`);
    return 0;
  }

  // Handle negative numbers
  const isNegative = normalized.startsWith('-');
  if (isNegative) {
    normalized = normalized.substring(1);
  }

  // Count separators
  const commaCount = (normalized.match(/,/g) || []).length;
  const dotCount = (normalized.match(/\./g) || []).length;

  let result: number;

  try {
    if (commaCount === 0 && dotCount === 0) {
      // No separators - simple integer
      result = parseFloat(normalized);
    } else if (commaCount > 0 && dotCount > 0) {
      // Both separators present - last one is decimal
      const lastCommaPos = normalized.lastIndexOf(',');
      const lastDotPos = normalized.lastIndexOf('.');
      
      if (lastCommaPos > lastDotPos) {
        // Comma is decimal separator (German format)
        result = parseFloat(normalized.replace(/\./g, '').replace(',', '.'));
      } else {
        // Dot is decimal separator (English format)
        result = parseFloat(normalized.replace(/,/g, ''));
      }
    } else if (commaCount > 0) {
      // Only commas present
      if (commaCount === 1) {
        const parts = normalized.split(',');
        // Check if comma is decimal separator based on detected format or decimal places
        if (detectedFormat === 'de' || (parts[1] && parts[1].length <= 8)) {
          // Comma is decimal separator
          result = parseFloat(normalized.replace(',', '.'));
        } else {
          // Comma is thousand separator
          result = parseFloat(normalized.replace(',', ''));
        }
      } else {
        // Multiple commas - thousand separators
        result = parseFloat(normalized.replace(/,/g, ''));
      }
    } else {
      // Only dots present
      if (dotCount === 1) {
        const parts = normalized.split('.');
        // Single dot with reasonable decimal places is decimal separator
        if (parts[1] && parts[1].length <= 8) {
          result = parseFloat(normalized);
        } else if (detectedFormat === 'de') {
          // German format - dot is thousand separator
          result = parseFloat(normalized.replace('.', ''));
        } else {
          // Default to decimal separator
          result = parseFloat(normalized);
        }
      } else {
        // Multiple dots - thousand separators (German format)
        result = parseFloat(normalized.replace(/\./g, ''));
      }
    }

    // Validate result
    if (isNaN(result) || !isFinite(result)) {
      // Try fallback parsing
      const englishAttempt = parseFloat(normalized.replace(/,/g, ''));
      if (!isNaN(englishAttempt) && isFinite(englishAttempt)) {
        result = englishAttempt;
        if (isDev) console.log(`[CSV Parser] Fallback zu Englisch-Format für '${fieldName}': "${value}" -> ${result}`);
      } else {
        const germanAttempt = parseFloat(normalized.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(germanAttempt) && isFinite(germanAttempt)) {
          result = germanAttempt;
          if (isDev) console.log(`[CSV Parser] Fallback zu Deutsch-Format für '${fieldName}': "${value}" -> ${result}`);
        } else {
          if (isDev) console.warn(`[CSV Parser] Konnte Zahl nicht parsen für '${fieldName}': "${value}" -> 0`);
          return 0;
        }
      }
    }

    if (isDev && fieldName) {
      console.log(`[CSV Parser] Geparst '${fieldName}': "${value}" -> ${isNegative ? -result : result}`);
    }

    return isNegative ? -result : result;
  } catch (error) {
    if (isDev) console.error(`[CSV Parser] Fehler beim Parsen von '${fieldName}': "${value}"`, error);
    return 0;
  }
}

/**
 * Normalizes column name to English equivalent
 */
function normalizeColumnName(columnName: string): string {
  const normalized = columnName.toLowerCase().trim();
  return GERMAN_COLUMN_MAPPINGS[normalized] || normalized;
}

/**
 * Detects the CSV delimiter (comma or semicolon)
 */
function detectDelimiter(line: string): string {
  const semicolonCount = (line.match(/;/g) || []).length;
  const commaCount = (line.match(/,/g) || []).length;
  
  const hasHyperliquidColumns = /\b(coin|px|sz|ntl|fee|closedPnl|dir)\b/i.test(line);
  
  if (hasHyperliquidColumns && commaCount > 0) {
    if (isDev) console.log('[CSV Parser] Hyperliquid-Format erkannt, verwende Komma als Trennzeichen');
    return ',';
  }
  
  const delimiter = semicolonCount > commaCount ? ';' : ',';
  if (isDev) console.log(`[CSV Parser] Erkanntes Trennzeichen: "${delimiter}" (Kommas: ${commaCount}, Semikolons: ${semicolonCount})`);
  return delimiter;
}

/**
 * Splits a CSV line respecting quoted values
 */
function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Interprets trade direction from Hyperliquid 'dir' column
 */
function interpretTradeDirection(dirValue: string): {
  isLiquidated: boolean;
  isLong: boolean;
  isOpening: boolean;
  liquidationReason?: string;
} {
  const normalized = dirValue.toLowerCase().trim();
  
  const isLiquidated = normalized.includes('liquidated') || normalized.includes('liquidiert');
  const isLong = normalized.includes('long');
  const isOpening = normalized.includes('open') || normalized.includes('öffnen');
  
  let liquidationReason: string | undefined;
  if (isLiquidated) {
    if (normalized.includes('isolated')) {
      liquidationReason = 'Isolierte Position liquidiert';
    } else if (normalized.includes('cross')) {
      liquidationReason = 'Cross-Margin Position liquidiert';
    } else {
      liquidationReason = 'Position liquidiert';
    }
  }
  
  if (isDev) {
    console.log(`[CSV Parser] Trade-Richtung interpretiert: "${dirValue}" -> Liquidiert: ${isLiquidated}, Long: ${isLong}, Eröffnung: ${isOpening}`);
  }
  
  return { isLiquidated, isLong, isOpening, liquidationReason };
}

/**
 * Parses time string in format DD.MM.YYYY - HH:MM:SS to ISO timestamp
 */
function parseTimeToISO(timeStr: string): string {
  if (!timeStr || timeStr.trim() === '') return '';
  
  try {
    const cleaned = timeStr.trim().replace(/\s*-\s*/, ' ');
    const parts = cleaned.split(' ');
    
    if (parts.length >= 2) {
      const dateParts = parts[0].split(/[./-]/);
      const timeParts = parts[1].split(':');
      
      if (dateParts.length === 3 && timeParts.length >= 2) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        const seconds = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
        
        const date = new Date(year, month, day, hours, minutes, seconds);
        
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    
    const timestamp = parseInt(timeStr, 10);
    if (!isNaN(timestamp) && timestamp > 1000000000) {
      const date = new Date(timestamp > 10000000000 ? timestamp : timestamp * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    
    if (isDev) console.warn(`[CSV Parser] Konnte Zeit nicht parsen: "${timeStr}"`);
    return '';
  } catch (error) {
    if (isDev) console.error(`[CSV Parser] Fehler beim Parsen der Zeit: "${timeStr}"`, error);
    return '';
  }
}

/**
 * Safely converts a number to float with validation
 * Returns the float value or 0 if invalid
 */
function safeFloat(value: number): number {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return 0;
  }
  return value;
}

/**
 * Rounds a number to two decimal places with proper rounding
 * Matches the backend roundToTwoDecimals implementation
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculates leverage dynamically from available fields using all data.
 * 
 * Formula priority (using ALL available data):
 * 1. If marginUsed > 0: leverage = (entryPrice * positionSize) / marginUsed
 * 2. Else if ntl > 0: leverage = ntl / (entryPrice * positionSize)
 * 3. Else if fee > 0: leverage = (entryPrice * positionSize) / (fee + 0.0001)
 * 4. Otherwise: return null
 * 
 * Returns null if calculation fails. NO default values (1x or 10x) are used.
 * Protects against division by zero and filters out invalid values.
 * Returns leverage with two decimal precision and correct rounding.
 */
function calculateLeverage(
  entryPrice: number,
  positionSize: number,
  marginUsed: number,
  notional: number,
  fee: number
): number | null {
  // Tolerance for float comparison
  const EPSILON = 0.000001;
  
  // Safely convert all inputs to valid floats
  const safeEntryPrice = safeFloat(entryPrice);
  const safePositionSize = safeFloat(positionSize);
  const safeMarginUsed = safeFloat(marginUsed);
  const safeNotional = safeFloat(notional);
  const safeFee = safeFloat(fee);
  
  // Validate inputs - all should be non-negative (except positionSize can be negative for shorts)
  if (safeEntryPrice < 0 || safeMarginUsed < 0 || safeNotional < 0 || safeFee < 0) {
    if (isDev) {
      console.log('[CSV Parser] Hebel-Berechnung fehlgeschlagen: Negative Werte erkannt');
    }
    return null;
  }
  
  // Check if we have minimum required data
  if (safeEntryPrice < EPSILON || Math.abs(safePositionSize) < EPSILON) {
    if (isDev) {
      console.log('[CSV Parser] Hebel-Berechnung fehlgeschlagen: Einstiegspreis oder Positionsgröße fehlt');
    }
    return null;
  }
  
  // Calculate position value (always use absolute position size)
  const positionValue = safeEntryPrice * Math.abs(safePositionSize);
  
  // Primary calculation: leverage = (entryPrice * positionSize) / marginUsed
  if (safeMarginUsed > EPSILON) {
    const calculatedLeverage = positionValue / safeMarginUsed;
    
    // Validate the calculated leverage is reasonable (between 0.1x and 1000x)
    if (calculatedLeverage >= 0.1 && calculatedLeverage <= 1000 && isFinite(calculatedLeverage)) {
      const rounded = roundToTwoDecimals(calculatedLeverage);
      if (isDev) {
        console.log(`[CSV Parser] Hebel berechnet (Primär): (${safeEntryPrice.toFixed(2)} * ${Math.abs(safePositionSize).toFixed(4)}) / ${safeMarginUsed.toFixed(2)} = ${rounded.toFixed(2)}x`);
      }
      return rounded;
    }
  }

  // Second fallback: leverage = ntl / (entryPrice * positionSize)
  if (safeNotional > EPSILON && positionValue > EPSILON) {
    const calculatedLeverage = Math.abs(safeNotional) / positionValue;
    
    // Validate the calculated leverage is reasonable (between 0.1x and 1000x)
    if (calculatedLeverage >= 0.1 && calculatedLeverage <= 1000 && isFinite(calculatedLeverage)) {
      const rounded = roundToTwoDecimals(calculatedLeverage);
      if (isDev) {
        console.log(`[CSV Parser] Hebel berechnet (Fallback 2): ${Math.abs(safeNotional).toFixed(2)} / (${safeEntryPrice.toFixed(2)} * ${Math.abs(safePositionSize).toFixed(4)}) = ${rounded.toFixed(2)}x`);
      }
      return rounded;
    }
  }

  // Third fallback: leverage = (entryPrice * positionSize) / (fee + 0.0001)
  if (safeFee > EPSILON) {
    const denominator = safeFee + 0.0001;
    const calculatedLeverage = positionValue / denominator;
    
    // Validate the calculated leverage is reasonable (between 0.1x and 1000x)
    if (calculatedLeverage >= 0.1 && calculatedLeverage <= 1000 && isFinite(calculatedLeverage)) {
      const rounded = roundToTwoDecimals(calculatedLeverage);
      if (isDev) {
        console.log(`[CSV Parser] Hebel berechnet (Fallback 3): (${safeEntryPrice.toFixed(2)} * ${Math.abs(safePositionSize).toFixed(4)}) / (${safeFee.toFixed(4)} + 0.0001) = ${rounded.toFixed(2)}x`);
      }
      return rounded;
    }
  }

  // If all calculations fail, return null (NO default values)
  if (isDev) {
    console.log('[CSV Parser] Hebel konnte nicht berechnet werden, gebe null zurück');
    console.log(`[CSV Parser] Verfügbare Werte: entryPrice=${safeEntryPrice}, positionSize=${safePositionSize}, marginUsed=${safeMarginUsed}, notional=${safeNotional}, fee=${safeFee}`);
  }
  return null;
}

export function parseCSV(csvText: string, fileName: string): { positions: TradePosition[]; summary: TradeSummary; fileName: string } {
  if (isDev) console.log('[CSV Parser] ========== STARTE CSV-PARSING ==========');
  if (isDev) console.log(`[CSV Parser] Dateiname: ${fileName}`);
  
  const lines = csvText.trim().split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length < 1) {
    throw new Error('CSV-Datei ist leer oder ungültig');
  }

  if (isDev) console.log(`[CSV Parser] Anzahl Zeilen: ${lines.length}`);

  const delimiter = detectDelimiter(lines[0]);
  const firstRowValues = splitCSVLine(lines[0], delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
  const hasHeaders = !isHeaderlessCSV(firstRowValues);

  let headers: string[];
  let dataStartIndex: number;

  if (hasHeaders) {
    const rawHeaders = firstRowValues;
    headers = rawHeaders.map(h => normalizeColumnName(h));
    dataStartIndex = 1;
    
    if (isDev) console.log('[CSV Parser] CSV mit Headern erkannt. Rohe Spalten:', rawHeaders);
    if (isDev) console.log('[CSV Parser] Normalisierte Spalten:', headers);
  } else {
    if (isDev) console.log('[CSV Parser] Headerlose CSV erkannt. Führe dynamisches Spalten-Mapping durch...');
    
    const allRows = lines.map(line => splitCSVLine(line, delimiter).map(v => v.trim().replace(/^"|"$/g, '')));
    headers = mapColumnsDynamically(allRows);
    dataStartIndex = 0;
  }

  if (headers.length === 0) {
    throw new Error('CSV-Struktur ungültig: Keine Spalten erkannt');
  }

  if (isDev) console.log(`[CSV Parser] Validierung: ${headers.length} Spalten erkannt`);

  const rows: CSVRow[] = [];
  for (let i = dataStartIndex; i < lines.length; i++) {
    const values = splitCSVLine(lines[i], delimiter);
    
    if (values.length !== headers.length) {
      if (isDev) console.warn(`[CSV Parser] Zeile ${i + 1} hat ${values.length} Werte, erwartet ${headers.length}. Überspringe oder passe an.`);
      while (values.length < headers.length) {
        values.push('');
      }
    }
    
    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
    });
    rows.push(row);
  }

  if (isDev) console.log(`[CSV Parser] ${rows.length} Datenzeilen erfolgreich geparst`);

  if (rows.length === 0) {
    throw new Error('Keine Datenzeilen in CSV gefunden');
  }

  const numericColumns = [
    'position size', 'size', 'positionsize', 'sz',
    'entry price', 'entry', 'entryprice', 'px',
    'liquidation price', 'liquidationprice', 'liq price',
    'realized pnl', 'realizedpnl', 'rpnl', 'closedpnl',
    'unrealized pnl', 'unrealizedpnl', 'upnl',
    'margin used', 'margin', 'marginused',
    'leverage', 'lev', 'price', 'pnl', 'numeric',
    'fee', 'ntl', 'notional'
  ];

  const sampleValues: string[] = [];
  for (const row of rows.slice(0, 50)) {
    for (const col of numericColumns) {
      if (row[col]) {
        sampleValues.push(row[col]);
      }
    }
    for (const key in row) {
      if (key.startsWith('numeric_') || key.startsWith('price') || key.startsWith('pnl')) {
        sampleValues.push(row[key]);
      }
    }
  }

  const detectedFormat = detectNumberFormat(sampleValues);

  if (isDev) console.log('[CSV Parser] ========== STARTE POSITIONS-KONVERTIERUNG ==========');

  const positions: TradePosition[] = rows.map((row, index) => {
    if (isDev) console.log(`[CSV Parser] --- Verarbeite Zeile ${index + 1} ---`);

    const timeStr = row['time'] || '';
    const timeISO = parseTimeToISO(timeStr);
    
    const directionValue = row['direction'] || row['dir'] || '';
    const directionInfo = directionValue ? interpretTradeDirection(directionValue) : null;

    const positionSize = normalizeNumber(
      row['position size'] || row['size'] || row['positionsize'] || row['sz'] || '0',
      'Positionsgröße (sz)',
      detectedFormat
    );
    const entryPrice = normalizeNumber(
      row['entry price'] || row['entry'] || row['entryprice'] || row['px'] || '0',
      'Einstiegspreis (px)',
      detectedFormat
    );
    const liquidationPriceValue = normalizeNumber(
      row['liquidation price'] || row['liquidationprice'] || row['liq price'] || '0',
      'Liquidationspreis',
      detectedFormat
    );
    const liquidationPrice = liquidationPriceValue > 0 ? liquidationPriceValue : undefined;
    
    const realizedPnl = normalizeNumber(
      row['realized pnl'] || row['realizedpnl'] || row['rpnl'] || row['closedpnl'] || '0',
      'Realisierter PnL (closedPnl)',
      detectedFormat
    );
    const unrealizedPnl = normalizeNumber(
      row['unrealized pnl'] || row['unrealizedpnl'] || row['upnl'] || '0',
      'Unrealisierter PnL',
      detectedFormat
    );
    
    const notional = normalizeNumber(
      row['notional'] || row['ntl'] || '0',
      'Notional (ntl)',
      detectedFormat
    );
    
    const marginUsed = normalizeNumber(
      row['margin used'] || row['margin'] || row['marginused'] || '0',
      'Verwendete Margin',
      detectedFormat
    );
    
    const fee = normalizeNumber(
      row['fee'] || '0',
      'Fee',
      detectedFormat
    );
    
    // Calculate leverage using ALL available data (entryPrice, positionSize, marginUsed, notional, fee)
    const leverage = calculateLeverage(entryPrice, positionSize, marginUsed, notional, fee);
    
    const statusText = (row['status'] || '').toLowerCase();
    const isLiquidated = directionInfo?.isLiquidated || 
                        statusText.includes('liquidated') || 
                        statusText.includes('liquidiert') || 
                        (statusText.includes('closed') || statusText.includes('geschlossen')) && unrealizedPnl < -marginUsed * 0.9;
    
    if (isDev) console.log(`[CSV Parser] Liquidiert: ${isLiquidated} (aus dir: ${directionInfo?.isLiquidated}, aus status: ${statusText})`);
    
    const riskLevel = calculateRiskLevel(entryPrice, liquidationPrice, marginUsed, unrealizedPnl);
    const status = determineStatus(isLiquidated, riskLevel);
    const liquidationReason = isLiquidated 
      ? (directionInfo?.liquidationReason || determineLiquidationReason(entryPrice, liquidationPrice, marginUsed, leverage || 1))
      : undefined;

    const baseTradeId = row['trade id'] || row['id'] || row['tradeid'] || row['tid'] || row['oid'] || `TRADE-${index + 1}`;
    const tradeId = timeISO ? `${timeISO}|${baseTradeId}` : baseTradeId;

    const symbol = row['symbol'] || row['coin'] || row['pair'] || row['asset'] || 'UNKNOWN';
    const isMetalAsset = isMetal(symbol);
    const isStablecoinAsset = isStablecoin(symbol);
    
    // Determine trade direction (Long or Short)
    const direction = directionInfo?.isLong ? TradeDirectionEnum.long_ : TradeDirectionEnum.short_;
    
    // Determine asset category
    let assetCategory: AssetCategoryEnum;
    if (isMetalAsset) {
      assetCategory = AssetCategoryEnum.metal;
    } else if (isStablecoinAsset) {
      assetCategory = AssetCategoryEnum.stablecoin;
    } else {
      assetCategory = AssetCategoryEnum.crypto;
    }

    const position: TradePosition = {
      tradeId,
      user: row['user'] || row['trader'] || 'Unbekannt',
      symbol,
      positionSize,
      entryPrice,
      liquidationPrice,
      realizedPnl,
      unrealizedPnl,
      marginUsed,
      isLiquidated,
      status,
      riskLevel,
      assetCategory,
      direction,
      leverage: leverage !== null ? leverage : undefined,
      fee,
    };

    if (isDev) {
      console.log(`[CSV Parser] Position erstellt:`, {
        tradeId: position.tradeId,
        symbol: position.symbol,
        size: position.positionSize,
        price: position.entryPrice,
        pnl: position.realizedPnl,
        fee: position.fee,
        liquidated: position.isLiquidated,
        assetCategory: position.assetCategory,
        direction: position.direction,
        leverage: leverage !== null ? `${leverage.toFixed(2)}x` : 'N/A',
        time: timeISO || 'keine Zeit'
      });
    }

    return position;
  });

  if (isDev) console.log(`[CSV Parser] ${positions.length} Positionen erfolgreich konvertiert`);

  const summary = calculateSummary(positions);

  if (isDev) {
    console.log('[CSV Parser] ========== ZUSAMMENFASSUNG ==========');
    console.log('[CSV Parser] Zusammenfassung:', {
      totalPositions: summary.totalPositions.toString(),
      liquidatedPositions: summary.liquidatedPositions.toString(),
      totalPnl: summary.totalPnl.toFixed(2),
      totalMargin: summary.totalMargin.toFixed(2),
      totalMetalsPnl: summary.totalMetalsPnl.toFixed(2),
      averageRiskLevel: summary.averageRiskLevel
    });
    console.log('[CSV Parser] ========== PARSING ABGESCHLOSSEN ==========');
  }

  return {
    positions,
    summary,
    fileName
  };
}

function calculateRiskLevel(entryPrice: number, liquidationPrice: number | undefined, marginUsed: number, unrealizedPnl: number): RiskLevel {
  if (!liquidationPrice || liquidationPrice === 0 || entryPrice === 0) {
    return RiskLevel.low;
  }

  const distanceToLiquidation = Math.abs(entryPrice - liquidationPrice) / entryPrice;
  const marginRatio = marginUsed > 0 ? unrealizedPnl / marginUsed : 0;

  if (distanceToLiquidation < 0.05 || marginRatio < -0.7) {
    return RiskLevel.extreme;
  } else if (distanceToLiquidation < 0.1 || marginRatio < -0.5) {
    return RiskLevel.high;
  } else if (distanceToLiquidation < 0.2 || marginRatio < -0.3) {
    return RiskLevel.medium;
  }
  
  return RiskLevel.low;
}

function determineStatus(isLiquidated: boolean, riskLevel: RiskLevel): PositionStatus {
  if (isLiquidated) {
    return PositionStatus.liquidated;
  }
  
  if (riskLevel === RiskLevel.extreme || riskLevel === RiskLevel.high) {
    return PositionStatus.atRisk;
  }
  
  return PositionStatus.safe;
}

function determineLiquidationReason(entryPrice: number, liquidationPrice: number | undefined, marginUsed: number, leverage: number): string {
  if (!liquidationPrice) {
    return 'Unzureichende Margin';
  }

  const distanceToLiquidation = Math.abs(entryPrice - liquidationPrice) / entryPrice;
  
  if (leverage > 20) {
    return `Hoher Hebel (${leverage.toFixed(1)}x) führte zur Liquidation`;
  } else if (distanceToLiquidation < 0.05) {
    return 'Liquidationspreis erreicht - Preis bewegte sich gegen Position';
  } else if (marginUsed < entryPrice * 0.05) {
    return 'Unzureichende Margin für die Positionsgröße';
  }
  
  return 'Liquidationspreis erreicht';
}

function calculateSummary(positions: TradePosition[]): TradeSummary {
  const totalPositions = BigInt(positions.length);
  const liquidatedPositions = BigInt(positions.filter(p => p.isLiquidated).length);
  
  const totalPnl = positions.reduce((sum, p) => sum + p.realizedPnl + p.unrealizedPnl, 0);
  const totalMargin = positions.reduce((sum, p) => sum + p.marginUsed, 0);
  
  const metalPositions = getMetalPositions(positions);
  const totalMetalsPnl = metalPositions.reduce((sum, p) => sum + p.realizedPnl + p.unrealizedPnl, 0);
  
  const riskScores = positions.map(p => {
    switch (p.riskLevel) {
      case RiskLevel.low: return 1;
      case RiskLevel.medium: return 2;
      case RiskLevel.high: return 3;
      case RiskLevel.extreme: return 4;
      default: return 1;
    }
  });
  
  const avgRiskScore = riskScores.length > 0 
    ? riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length 
    : 1;
  
  let averageRiskLevel: RiskLevel;
  if (avgRiskScore >= 3.5) {
    averageRiskLevel = RiskLevel.extreme;
  } else if (avgRiskScore >= 2.5) {
    averageRiskLevel = RiskLevel.high;
  } else if (avgRiskScore >= 1.5) {
    averageRiskLevel = RiskLevel.medium;
  } else {
    averageRiskLevel = RiskLevel.low;
  }

  return {
    totalPositions,
    liquidatedPositions,
    totalPnl,
    totalMargin,
    averageRiskLevel,
    totalMetalsPnl,
  };
}
