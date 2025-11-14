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

  const accountId = chainId + "-" + accountAddress;

  let account = await context.Account.get(accountId);

  if (!account) {
    account = {
      id: accountId,
      address: accountAddress,
      createdAtTimestamp: timestamp,
    };
    context.Account.set(account);
  }

  return account;
}

