// Re-export AMM handlers
// Reference: spectra-subgraph-master/src/mappings/amm.ts

// Import all AMM mapping files to ensure handlers are registered
import "./amm/addLiquidity";
import "./amm/removeLiquidity";
import "./amm/removeLiquidityOne";
import "./amm/tokenExchange";
import "./amm/adminFee";
import "./amm/newParameters";

