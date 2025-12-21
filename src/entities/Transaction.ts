// Reference: spectra-subgraph-master/src/entities/Transaction.ts

import { Transaction_t } from "generated/src/db/Entities.gen";
import { ZERO_ADDRESS, ZERO_BI } from "../constants";
import { getAccount } from "./Account";

interface CreateTransactionParams {
  id: string;
  transactionAddress: string;
  futureInTransaction: string;
  userInTransaction: string;
  poolInTransaction: string;
   // Optional metavault context (for metavault-related transactions)
  metavaultInTransaction?: string;
  amountsIn: string[];
  amountsOut: string[];
  valueUnderlying: bigint;
  feeUnderlying: bigint;
  feeRatio: bigint;
  transaction: {
    timestamp: bigint;
    block: bigint;
    gas: bigint;
    gasPrice: bigint;
    type: string;
    fee: bigint;
    adminFee: bigint;
  };
  ibtRate: bigint;
  ptRate: bigint;
  // Optional metavault-specific fields
  metavaultEpochId?: bigint;
  metavaultShares?: bigint;
  metavaultAssets?: bigint;
}

/**
 * Create Transaction entity
 * Reference: spectra-subgraph-master/src/entities/Transaction.ts
 */
export async function createTransaction(
  params: CreateTransactionParams,
  chainId: number,
  context: any
): Promise<Transaction_t> {
  // Prefix with chainId for multichain support
  const transactionId = `${chainId}-${params.id}`;
  
  let transaction = await context.Transaction.get(transactionId);
  
  if (!transaction) {
    // Get user account if provided
    let userInTransaction_id: string | undefined = undefined;
    if (params.userInTransaction !== ZERO_ADDRESS) {
      const account = await getAccount(
        params.userInTransaction,
        params.transaction.timestamp,
        chainId,
        context
      );
      userInTransaction_id = account.id;
    }
    
    // Get future if provided
    let futureInTransaction_id: string | undefined = undefined;
    if (params.futureInTransaction !== ZERO_ADDRESS) {
      const futureId = `${chainId}-${params.futureInTransaction}`;
      const future = await context.Future.get(futureId);
      if (future) {
        futureInTransaction_id = future.id;
      }
    }
    
    // Get pool if provided
    let poolInTransaction_id: string | undefined = undefined;
    if (params.poolInTransaction !== ZERO_ADDRESS) {
      const poolId = `${chainId}-${params.poolInTransaction}`;
      const pool = await context.Pool.get(poolId);
      if (pool) {
        poolInTransaction_id = pool.id;
      }
    }
    // Get metavault if provided
    let metavaultInTransaction_id: string | undefined = undefined;
    if (params.metavaultInTransaction && params.metavaultInTransaction !== ZERO_ADDRESS) {
      const metavaultId = `${chainId}-${params.metavaultInTransaction}`;
      const metavault = await context.Metavault.get(metavaultId);
      if (metavault) {
        metavaultInTransaction_id = metavault.id;
      }
    }
    
    // Create Transaction entity
    transaction = {
      id: transactionId,
      createdAtTimestamp: params.transaction.timestamp,
      address: params.transactionAddress,
      block: params.transaction.block,
      transactionType: params.transaction.type as any, // TransactionType enum
      gas: params.transaction.gas,
      gasPrice: params.transaction.gasPrice,
      fee: params.transaction.fee !== ZERO_BI ? params.transaction.fee : ZERO_BI, // Set to ZERO_BI instead of undefined (matches subgraph behavior but ensures "0" not null)
      adminFee: params.transaction.adminFee !== ZERO_BI ? params.transaction.adminFee : ZERO_BI, // Set to ZERO_BI instead of undefined
      valueUnderlying: params.valueUnderlying,
      feeUnderlying: params.feeUnderlying,
      feeRatio: params.feeRatio,
      // Note: ibtRate and ptRate are passed as params but not stored in Transaction entity (matches subgraph behavior)
      // Relationships
      userInTransaction_id: userInTransaction_id,
      futureInTransaction_id: futureInTransaction_id,
      poolInTransaction_id: poolInTransaction_id,
      metavaultInTransaction_id: metavaultInTransaction_id,
      // Metavault-specific numeric fields (optional)
      metavaultEpochId: params.metavaultEpochId && params.metavaultEpochId !== ZERO_BI ? params.metavaultEpochId : undefined,
      metavaultShares: params.metavaultShares && params.metavaultShares !== ZERO_BI ? params.metavaultShares : undefined,
      metavaultAssets: params.metavaultAssets && params.metavaultAssets !== ZERO_BI ? params.metavaultAssets : undefined,
      // amountsIn and amountsOut are @derivedFrom, so we don't set them
    };
    context.Transaction.set(transaction);
  }
  
  return transaction;
}
