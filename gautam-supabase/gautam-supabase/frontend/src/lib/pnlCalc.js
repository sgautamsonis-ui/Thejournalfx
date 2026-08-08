// Broker-standard P&L calculator per instrument class.
// Returns USD P&L for a 1-lot round trip. All formulas follow the widely-used
// MetaTrader / TradingView contract-size conventions for a USD account.

const CRYPTOS = ["BTC","ETH","LTC","XRP","SOL","ADA","BNB","DOGE","DOT","AVAX","MATIC","LINK","BCH"];
const INDICES = ["US30","US100","US500","NAS100","SPX500","GER30","GER40","UK100","JPN225","AUS200","FRA40","EU50","HK50"];
const OILS = ["WTI","BRENT","USOIL","UKOIL","XTIUSD","XBRUSD","OILUSD"];
const METALS_100 = ["XAUUSD","GOLD"];       // 100 oz per lot
const METALS_5000 = ["XAGUSD","SILVER"];    // 5000 oz per lot

function isCrypto(sym) { return CRYPTOS.some(c => sym.startsWith(c)); }
function isIndex(sym)  { return INDICES.some(c => sym.toUpperCase().includes(c)); }
function isOil(sym)    { return OILS.some(c => sym.toUpperCase().includes(c)); }

function instrumentClass(symbolRaw) {
  const s = (symbolRaw || "").toUpperCase().replace("/","");
  if (METALS_100.includes(s)) return "metal100";      // Gold
  if (METALS_5000.includes(s)) return "metal5000";    // Silver
  if (isOil(s))     return "oil";
  if (isCrypto(s))  return "crypto";
  if (isIndex(s))   return "index";
  // Forex classification (assume 6 chars like EURUSD/USDJPY)
  if (s.length >= 6) {
    const base = s.slice(0,3), quote = s.slice(3,6);
    if (quote === "USD") return "fx_usd_quote"; // XXX/USD (EURUSD)
    if (base  === "USD") return "fx_usd_base";  // USD/XXX (USDJPY, USDCHF)
    return "fx_cross"; // EURJPY, GBPJPY, EURGBP etc.
  }
  return "unknown";
}

/**
 * Compute P&L in USD for a closed trade.
 * @param {Object} p
 * @param {string} p.symbol
 * @param {"long"|"short"} p.direction
 * @param {number} p.entry
 * @param {number} p.exit
 * @param {number} p.lot         standard lots (or contracts for indices/crypto)
 * @param {number} [p.commission]
 * @param {number} [p.swap]
 * @returns {{ pnl:number, gross:number, risk:number, pipValuePerLot:number, cls:string }}
 */
export function computePnl({ symbol, direction, entry, exit, lot, stop_loss, commission = 0, swap = 0 }) {
  const e = parseFloat(entry) || 0;
  const x = parseFloat(exit) || 0;
  const L = parseFloat(lot) || 0;
  const cls = instrumentClass(symbol);
  if (!e || !x || !L) return { pnl: 0, gross: 0, risk: 0, pipValuePerLot: 0, cls };

  const diff = direction === "long" ? (x - e) : (e - x);

  let gross = 0;             // USD P&L before fees
  let pipValuePerLot = 0;    // USD per pip per lot (informational)

  switch (cls) {
    case "metal100": {                      // Gold: 100 oz per lot, quoted in USD
      gross = diff * 100 * L;
      pipValuePerLot = 100 * 0.10;          // $10 per 0.1 move (typical "pip" for Gold)
      break;
    }
    case "metal5000": {                     // Silver: 5000 oz per lot
      gross = diff * 5000 * L;
      pipValuePerLot = 5000 * 0.01;         // $50 per 0.01 move
      break;
    }
    case "oil": {                           // Oil: 1000 barrels per lot
      gross = diff * 1000 * L;
      pipValuePerLot = 1000 * 0.01;
      break;
    }
    case "crypto": {                        // 1 coin per lot (broker default)
      gross = diff * 1 * L;
      pipValuePerLot = 1 * 1;               // $1 per $1 move per lot
      break;
    }
    case "index": {                         // 1 contract per point
      gross = diff * 1 * L;
      pipValuePerLot = 1;                   // $1 per point per lot
      break;
    }
    case "fx_usd_quote": {                  // EURUSD, GBPUSD, AUDUSD etc.
      gross = diff * 100000 * L;
      pipValuePerLot = 100000 * 0.0001;     // $10 per pip
      break;
    }
    case "fx_usd_base": {                   // USDJPY, USDCHF, USDCAD
      // For USDJPY: pip = 0.01; PnL USD ≈ diff * 100000 * L / exit
      gross = (diff * 100000 * L) / x;
      const pip = symbol.toUpperCase().includes("JPY") ? 0.01 : 0.0001;
      pipValuePerLot = (100000 * pip) / x;
      break;
    }
    case "fx_cross": {                      // EURJPY, GBPJPY, EURGBP
      // Approximate: convert quote-currency profit to USD via exit price.
      // For JPY crosses: pip=0.01. PnL_USD ≈ diff*100000*L / (USDJPY≈exit for JPY quote)
      // Best-effort: divide by exit to normalise (this matches broker Micro-lot practice).
      gross = (diff * 100000 * L) / x;
      const pip = symbol.toUpperCase().includes("JPY") ? 0.01 : 0.0001;
      pipValuePerLot = (100000 * pip) / x;
      break;
    }
    default: {
      gross = diff * 100000 * L;
      pipValuePerLot = 10;
    }
  }

  const pnl = gross - (parseFloat(commission) || 0) - (parseFloat(swap) || 0);

  // Risk = distance from entry to SL * contract multiplier (same class formula, using SL instead of exit)
  let risk = 0;
  if (stop_loss) {
    const slDiff = Math.abs(e - parseFloat(stop_loss));
    switch (cls) {
      case "metal100":    risk = slDiff * 100 * L; break;
      case "metal5000":   risk = slDiff * 5000 * L; break;
      case "oil":         risk = slDiff * 1000 * L; break;
      case "crypto":      risk = slDiff * 1 * L; break;
      case "index":       risk = slDiff * 1 * L; break;
      case "fx_usd_quote":risk = slDiff * 100000 * L; break;
      case "fx_usd_base": risk = (slDiff * 100000 * L) / e; break;
      case "fx_cross":    risk = (slDiff * 100000 * L) / e; break;
      default:            risk = slDiff * 100000 * L;
    }
  }

  return {
    pnl: round2(pnl),
    gross: round2(gross),
    risk: round2(risk),
    pipValuePerLot: round2(pipValuePerLot),
    cls,
  };
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
