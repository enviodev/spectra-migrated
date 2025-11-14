// Reference: spectra-subgraph-master/src/mappings/amm/adminFee.ts

import { CurvePool } from "generated";
import { ZERO_BI } from "../../constants";
import { createFeeClaim } from "../../entities/FeeClaim";

// CurvePool ClaimAdminFee handlers
CurvePool.ClaimAdminFee.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/adminFee.ts handleClaimAdminFee
  // Prefix with chainId for multichain support
  const poolId = `${event.chainId}-${event.srcAddress}`;

  const pool = await context.Pool.get(poolId);
  if (!pool) {
    context.log.warn(`ClaimAdminFee event call for non-existing Pool ${event.srcAddress}`);
    return;
  }

  // Create FeeClaim entity
  await createFeeClaim(
    event.params.admin,
    BigInt(event.block.timestamp),
    poolId,
    event.params.tokens,
    ZERO_BI,
    ZERO_BI,
    event.chainId,
    context
  );

  // Update Pool entity
  context.Pool.set({
    ...pool,
    totalClaimedAdminFees: pool.totalClaimedAdminFees + event.params.tokens,
  });
});

// CurvePoolNG ClaimAdminFee handlers
// Note: Original subgraph has this as TODO (see handleClaimAdminFeeNG in spectra-subgraph-master/src/mappings/amm/adminFee.ts)
// Leaving as TODO to match original subgraph implementation
CurvePool.ClaimAdminFeeNG.handler(async ({ event, context }) => {
  // TODO: Original subgraph has this as TODO - not implemented
  // Reference: spectra-subgraph-master/src/mappings/amm/adminFee.ts line 27-29
});

