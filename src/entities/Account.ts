// Reference: spectra-subgraph-master/src/entities/Account.ts

import { Account } from "generated";

/**
 * Get or create an Account entity
 * No dependencies - simple entity creation/retrieval
 */
export async function getAccount(
  accountAddress: string,
  timestamp: bigint,
  chainId: number,
  context: any
): Promise<Account> {
  // Normalize address to lowercase to prevent duplicate entries
  const normalizedAddress = accountAddress.toLowerCase();

  const accountId = chainId + "-" + normalizedAddress;

  let account = await context.Account.get(accountId);

  if (!account) {
    account = {
      id: accountId,
      address: normalizedAddress, // Store normalized (lowercase) address
      createdAtTimestamp: timestamp,
    };
    context.Account.set(account);
  }

  return account;
}

