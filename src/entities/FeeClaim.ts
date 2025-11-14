// Reference: spectra-subgraph-master/src/entities/FeeClaim.ts

import { FeeClaim } from "generated";
import { ZERO_BI } from "../constants";
import { generateFeeClaimId } from "../utils/idGenerators";
import { getAccount } from "./Account";
import { getPoolAdminBalances as getPoolAdminBalancesEffect } from "../effects/getPoolAdminBalances";

/**
 * Create FeeClaim entity
 */
export async function createFeeClaim(
  admin: string,
  timestamp: bigint,
  poolId: string,
  amount: bigint,
  ibtAmount: bigint,
  ptAmount: bigint,
  chainId: number,
  context: any
): Promise<FeeClaim> {
  // Generate fee claim ID
  const claimId = generateFeeClaimId(admin, timestamp.toString());
  
  // Prefix with chainId for multichain support
  const claimIdWithChain = `${chainId}-${claimId}`;
  
  // Get or create fee collector account
  const feeCollector = await getAccount(admin, timestamp, chainId, context);
  
  // Create FeeClaim entity
  const feeClaim = {
    id: claimIdWithChain,
    createdAtTimestamp: timestamp,
    amount: amount,
    ibtAmount: ibtAmount,
    ptAmount: ptAmount,
    feeCollector_id: feeCollector.id,
    future_id: undefined,
    pool_id: poolId,
  };
  
  context.FeeClaim.set(feeClaim);
  return feeClaim;
}

/**
 * Get pool admin balances
 * Reference: spectra-subgraph-master/src/entities/FeeClaim.ts
 */
export async function getPoolAdminBalances(
  poolAddress: string,
  poolType: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<[bigint, bigint]> {
  const result = await context.effect(getPoolAdminBalancesEffect, {
    poolAddress: poolAddress,
    poolType: poolType,
    chainId: chainId,
    blockNumber: blockNumber,
  });
  
  const data = result as { ibtAdminBalance: string; ptAdminBalance: string };
  return [
    BigInt(data.ibtAdminBalance || ZERO_BI.toString()),
    BigInt(data.ptAdminBalance || ZERO_BI.toString()),
  ];
}
