// Reference: spectra-subgraph-master/src/constants.ts

import { BigDecimal } from "generated";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
export const ZERO_BD = new BigDecimal("0")
export const UNIT_BD = new BigDecimal("1")
export const ZERO_BI = BigInt(0)
export const UNIT_BI = BigInt(1)
export const CURVE_UNIT = BigInt("1000000000000000000")

export const SECONDS_PER_HOUR = 3600
export const SECONDS_PER_DAY = 86400
export const DAYS_PER_YEAR_BD = new BigDecimal("364.25")
export const SECONDS_PER_YEAR = new BigDecimal("31556926")

export const DAY_ID_0 = "0"

// ==============================================================
// PERFORMANCE FLAGS - Set to true to disable expensive RPC calls
// ==============================================================

/**
 * When true, returns dummy data for pool price calculations instead of making RPC calls
 * This significantly speeds up indexing but results in inaccurate price data
 */
export const SKIP_PRICE_CALCULATIONS = true;

/**
 * When true, returns dummy data for rate calculations (IBT rate, PT rate)
 * This speeds up indexing but results in inaccurate rate data
 */
export const SKIP_RATE_CALCULATIONS = true;

/**
 * When true, skips balance fetching via RPC calls
 * This speeds up indexing but AccountAsset balances will be inaccurate
 */
export const SKIP_BALANCE_FETCHING = true;
