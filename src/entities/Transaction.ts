// Reference: spectra-subgraph-master/src/entities/Transaction.ts

import { Transaction_t } from "generated/src/db/Entities.gen";
import { ZERO_ADDRESS, ZERO_BI } from "../constants";
import { getAccount } from "./Account";
import { generateTransactionId } from "../utils/idGenerators";

interface CreateTransactionParams {
  id: string;
  transactionAddress: string;
  futureInTransaction: string;
  userInTransaction: string;
  poolInTransaction: string;
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
    
    // Create Transaction entity
    transaction = {
      id: transactionId,
      createdAtTimestamp: params.transaction.timestamp,
      address: params.transactionAddress,
      block: params.transaction.block,
      transactionType: params.transaction.type as any, // TransactionType enum
      gas: params.transaction.gas,
      gasPrice: params.transaction.gasPrice,
      fee: params.transaction.fee !== ZERO_BI ? params.transaction.fee : undefined,
      adminFee: params.transaction.adminFee !== ZERO_BI ? params.transaction.adminFee : undefined,
      valueUnderlying: params.valueUnderlying,
      feeUnderlying: params.feeUnderlying,
      feeRatio: params.feeRatio,
      // Relationships
      userInTransaction_id: userInTransaction_id,
      futureInTransaction_id: futureInTransaction_id,
      poolInTransaction_id: poolInTransaction_id,
      // amountsIn and amountsOut are @derivedFrom, so we don't set them
    };
    context.Transaction.set(transaction);
  }
  
  return transaction;
}
