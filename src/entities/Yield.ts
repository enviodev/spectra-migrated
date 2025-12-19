// Reference: spectra-subgraph-master/src/entities/Yield.ts

import { AccountAsset_t, Asset_t } from "generated/src/db/Entities.gen";
import { ZERO_BI } from "../constants";
import { generateAccountAssetId, generateYieldAssetId, generateClaimedYieldAssetId } from "../utils/idGenerators";
import { AssetType } from "../utils/AssetType";
import { getAccount } from "./Account";
import { getAsset } from "./Asset";
import { getERC20Decimals } from "./ERC20";
import { getName, getSymbol, getIBT, getUnderlying, getCurrentYieldOfUserInIBT } from "./FutureVault";
import { getIBTAsset } from "./IBTAsset";

/**
 * Create yield asset entity
 * Reference: spectra-subgraph/src/entities/Yield.ts createYieldAsset (lines 21-46)
 */
async function createYieldAsset(
  principalToken: string,
  underlyingAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<Asset_t> {
  // Generate yield asset ID: {principalToken}-yield
  const yieldAssetId = generateYieldAssetId(principalToken);
  const yieldAssetIdWithChain = `${chainId}-${yieldAssetId}`;

  // Get PrincipalToken name and symbol
  const [ptName, ptSymbol] = await Promise.all([
    getName(principalToken, chainId, blockNumber, context),
    getSymbol(principalToken, chainId, blockNumber, context),
  ]);

  // Get underlying asset decimals
  const underlyingDecimals = await getERC20Decimals(
    underlyingAddress,
    chainId,
    blockNumber,
    context
  );

  // Get or create underlying asset
  const underlyingAsset = await getAsset(
    underlyingAddress,
    timestamp,
    AssetType.UNDERLYING,
    null,
    chainId,
    blockNumber,
    context
  );

  // Create yield asset entity
  // Reference: subgraph only sets: chainId, address, createdAtTimestamp, type, name, symbol, decimals, underlying, futureVault
  // Other fields are not set by subgraph, so they remain undefined
  const yieldAsset: Asset_t = {
    id: yieldAssetIdWithChain,
    chainId: chainId,
    address: underlyingAddress.toLowerCase(), // Store underlying address
    createdAtTimestamp: timestamp,
    assetType: AssetType.YIELD as any,
    name: `${ptName} Yield`,
    symbol: `${ptSymbol} Yield`,
    decimals: underlyingDecimals,
    underlying_id: underlyingAsset.id,
    futureVault_id: `${chainId}-${principalToken.toLowerCase()}`,
    // Fields not set by subgraph - left undefined
    price_id: undefined,
    chainlinkPriceFeed_id: undefined,
    ibt_id: undefined,
    fytTokenDetails_id: undefined,
    lpTokenDetails_id: undefined,
    lastIBTRate: undefined,
    convertToAssetsUnit: undefined,
    lastUpdateTimestamp: undefined,
  };

  context.Asset.set(yieldAsset);
  return yieldAsset;
}

/**
 * Get or create yield asset
 * Reference: spectra-subgraph/src/entities/Yield.ts getYieldAsset (lines 48-61)
 */
async function getYieldAsset(
  principalToken: string,
  underlyingAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<Asset_t> {
  // Generate yield asset ID
  const yieldAssetId = generateYieldAssetId(principalToken);
  const yieldAssetIdWithChain = `${chainId}-${yieldAssetId}`;

  // Check if yield asset already exists
  let yieldAsset = await context.Asset.get(yieldAssetIdWithChain);
  if (yieldAsset) {
    return yieldAsset;
  }

  // Create yield asset if it doesn't exist
  yieldAsset = await createYieldAsset(
    principalToken,
    underlyingAddress,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  return yieldAsset;
}

/**
 * Get or create AccountAsset for yield
 * Reference: spectra-subgraph/src/entities/Yield.ts getAccountYieldAsset (lines 63-93)
 */
export async function getAccountYieldAsset(
  accountAddress: string,
  principalToken: string,
  underlyingAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<AccountAsset_t> {
  // Normalize addresses to lowercase
  const normalizedAccountAddress = accountAddress.toLowerCase();
  const normalizedPrincipalToken = principalToken.toLowerCase();
  const normalizedUnderlyingAddress = underlyingAddress.toLowerCase();

  // Get or create account
  const account = await getAccount(normalizedAccountAddress, timestamp, chainId, context);

  // Get or create yield asset
  const yieldAsset = await getYieldAsset(
    normalizedPrincipalToken,
    normalizedUnderlyingAddress,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  // Generate account asset ID
  // Subgraph uses: generateAccountAssetId(account.address.toHex(), asset.id)
  // where asset.id is the yield asset ID: {principalToken}-yield
  const yieldAssetIdWithoutChain = yieldAsset.id.replace(`${chainId}-`, "");
  const accountAssetId = `${chainId}-${generateAccountAssetId(
    account.address.toLowerCase(),
    yieldAssetIdWithoutChain,
    "" // No prefix for yield assets
  )}`;

  // Check if account asset already exists
  let accountAsset = await context.AccountAsset.get(accountAssetId);
  if (accountAsset) {
    return accountAsset;
  }

  // Create account asset if it doesn't exist
  accountAsset = {
    id: accountAssetId,
    createdAtTimestamp: timestamp,
    balance: ZERO_BI,
    epochId: ZERO_BI,
    asset_id: yieldAsset.id,
    account_id: account.id,
    pool_id: undefined,
    principalToken_id: undefined,
    generatedYield: undefined,
  };

  context.AccountAsset.set(accountAsset);
  return accountAsset;
}

/**
 * Create claimed yield asset entity
 * Reference: spectra-subgraph/src/entities/Yield.ts createClaimedYieldAsset (lines 95-116)
 */
async function createClaimedYieldAsset(
  principalToken: string,
  ibtAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<Asset_t> {
  // Generate claimed yield asset ID: {principalToken}-claimed-yield
  const claimedYieldAssetId = generateClaimedYieldAssetId(principalToken);
  const claimedYieldAssetIdWithChain = `${chainId}-${claimedYieldAssetId}`;

  // Get PrincipalToken name and symbol
  const [ptName, ptSymbol] = await Promise.all([
    getName(principalToken, chainId, blockNumber, context),
    getSymbol(principalToken, chainId, blockNumber, context),
  ]);

  // Get IBT asset decimals
  const ibtDecimals = await getERC20Decimals(
    ibtAddress,
    chainId,
    blockNumber,
    context
  );

  // Get or create IBT asset
  const ibtAsset = await getIBTAsset(
    ibtAddress,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  // Create claimed yield asset entity
  // Reference: subgraph only sets: chainId, address, createdAtTimestamp, type, name, symbol, decimals, ibt, futureVault
  // Other fields are not set by subgraph, so they remain undefined
  const claimedYieldAsset: Asset_t = {
    id: claimedYieldAssetIdWithChain,
    chainId: chainId,
    address: ibtAddress.toLowerCase(), // Store IBT address
    createdAtTimestamp: timestamp,
    assetType: AssetType.CLAIMED_YIELD as any,
    name: `${ptName} Claimed Yield`,
    symbol: `${ptSymbol} Claimed Yield`,
    decimals: ibtDecimals,
    ibt_id: ibtAsset.id,
    futureVault_id: `${chainId}-${principalToken.toLowerCase()}`,
    // Fields not set by subgraph - left undefined
    price_id: undefined,
    chainlinkPriceFeed_id: undefined,
    underlying_id: undefined,
    fytTokenDetails_id: undefined,
    lpTokenDetails_id: undefined,
    lastIBTRate: undefined,
    convertToAssetsUnit: undefined,
    lastUpdateTimestamp: undefined,
  };

  context.Asset.set(claimedYieldAsset);
  return claimedYieldAsset;
}

/**
 * Get or create claimed yield asset
 * Reference: spectra-subgraph/src/entities/Yield.ts getClaimedYieldAsset (lines 118-131)
 */
async function getClaimedYieldAsset(
  principalToken: string,
  ibtAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<Asset_t> {
  // Generate claimed yield asset ID
  const claimedYieldAssetId = generateClaimedYieldAssetId(principalToken);
  const claimedYieldAssetIdWithChain = `${chainId}-${claimedYieldAssetId}`;

  // Check if claimed yield asset already exists
  let claimedYieldAsset = await context.Asset.get(claimedYieldAssetIdWithChain);
  if (claimedYieldAsset) {
    return claimedYieldAsset;
  }

  // Create claimed yield asset if it doesn't exist
  claimedYieldAsset = await createClaimedYieldAsset(
    principalToken,
    ibtAddress,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  return claimedYieldAsset;
}

/**
 * Get or create AccountAsset for claimed yield
 * Reference: spectra-subgraph/src/entities/Yield.ts getAccountClaimedYieldAsset (lines 133-172)
 */
export async function getAccountClaimedYieldAsset(
  accountAddress: string,
  principalToken: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<AccountAsset_t> {
  // Normalize addresses to lowercase
  const normalizedAccountAddress = accountAddress.toLowerCase();
  const normalizedPrincipalToken = principalToken.toLowerCase();

  // Get IBT address from PrincipalToken
  const ibtAddress = await getIBT(normalizedPrincipalToken, chainId, blockNumber, context);
  const normalizedIbtAddress = ibtAddress.toLowerCase();

  // Get or create claimed yield asset
  let claimedYieldAsset = await getClaimedYieldAsset(
    normalizedPrincipalToken,
    normalizedIbtAddress,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  // Get IBT asset (subgraph gets it again and updates the claimed yield asset's ibt relationship)
  const ibtAsset = await getAsset(
    normalizedIbtAddress,
    timestamp,
    AssetType.IBT,
    null,
    chainId,
    blockNumber,
    context
  );

  // Update claimed yield asset's ibt relationship (subgraph does this)
  const updatedClaimedYieldAsset: Asset_t = {
    ...claimedYieldAsset,
    ibt_id: ibtAsset.id,
  };
  context.Asset.set(updatedClaimedYieldAsset);

  // Get or create account
  const account = await getAccount(normalizedAccountAddress, timestamp, chainId, context);

  // Generate account asset ID with "claimed-" prefix
  // Subgraph uses: generateAccountAssetId(account.address.toHex(), claimedYieldAsset.id, "claimed-")
  const claimedYieldAssetIdWithoutChain = claimedYieldAsset.id.replace(`${chainId}-`, "");
  const accountAssetId = `${chainId}-${generateAccountAssetId(
    account.address.toLowerCase(),
    claimedYieldAssetIdWithoutChain,
    "claimed-"
  )}`;

  // Check if account asset already exists
  let accountAsset = await context.AccountAsset.get(accountAssetId);
  if (accountAsset) {
    return accountAsset;
  }

  // Create account asset if it doesn't exist
  accountAsset = {
    id: accountAssetId,
    createdAtTimestamp: timestamp,
    balance: ZERO_BI,
    epochId: ZERO_BI,
    asset_id: updatedClaimedYieldAsset.id,
    account_id: account.id,
    pool_id: undefined,
    principalToken_id: undefined,
    generatedYield: undefined,
  };

  context.AccountAsset.set(accountAsset);
  return accountAsset;
}

/**
 * Update yield account asset balance
 * Reference: spectra-subgraph/src/entities/Yield.ts updateYieldAccountAssetBalance (lines 174-195)
 */
export async function updateYieldAccountAssetBalance(
  principalToken: string,
  accountAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<AccountAsset_t> {
  // Normalize addresses to lowercase
  const normalizedPrincipalToken = principalToken.toLowerCase();
  const normalizedAccountAddress = accountAddress.toLowerCase();

  // Get underlying address from PrincipalToken
  const underlyingAddress = await getUnderlying(normalizedPrincipalToken, chainId, blockNumber, context);
  const normalizedUnderlyingAddress = underlyingAddress.toLowerCase();

  // Get yield asset (this will create it if it doesn't exist)
  // Note: subgraph line 179 passes accountAddress as underlyingAddress, but that seems wrong
  // Looking at line 184, it uses yieldAsset.address, so we should use underlyingAddress
  const yieldAsset = await getYieldAsset(
    normalizedPrincipalToken,
    normalizedUnderlyingAddress,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  // Get account yield asset (this will create it if it doesn't exist)
  const accountYieldAsset = await getAccountYieldAsset(
    normalizedAccountAddress,
    normalizedPrincipalToken,
    normalizedUnderlyingAddress,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  // Get current yield of user in IBT via RPC call
  const currentYieldInIBT = await getCurrentYieldOfUserInIBT(
    normalizedPrincipalToken,
    normalizedAccountAddress,
    chainId,
    blockNumber,
    context
  );

  // Update account yield asset balance
  const updatedAccountYieldAsset: AccountAsset_t = {
    ...accountYieldAsset,
    balance: currentYieldInIBT,
  };

  context.AccountAsset.set(updatedAccountYieldAsset);
  return updatedAccountYieldAsset;
}

/**
 * Update claimed yield account asset balance
 * Reference: spectra-subgraph/src/entities/Yield.ts updateClaimedYieldAccountAssetBalance (lines 197-210)
 */
export async function updateClaimedYieldAccountAssetBalance(
  principalToken: string,
  accountAddress: string,
  claimBalance: bigint,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<AccountAsset_t> {
  const accountAsset = await getAccountClaimedYieldAsset(
    accountAddress,
    principalToken,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  // Update balance
  const updatedAccountAsset = {
    ...accountAsset,
    balance: accountAsset.balance + claimBalance,
  };

  context.AccountAsset.set(updatedAccountAsset);
  return updatedAccountAsset;
}

/**
 * Update yield for all accounts holding YT tokens
 * Reference: spectra-subgraph/src/entities/Yield.ts updateYieldForAll (lines 223-244)
 */
export async function updateYieldForAll(
  principalTokenAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<void> {
  // Normalize address to lowercase
  const normalizedPrincipalTokenAddress = principalTokenAddress.toLowerCase();

  // Get Future entity
  const futureId = `${chainId}-${normalizedPrincipalTokenAddress}`;
  const future = await context.Future.get(futureId);

  if (!future) {
    // Future doesn't exist, nothing to update
    return;
  }

  // Query AccountAsset entities where principalToken_id matches and generatedYield = true
  // Note: In Envio, we use indexed field operations to query by relationship field
  // The yieldGenerators field is @derivedFrom AccountAsset.principalToken, so we query by principalToken_id
  try {
    // Try to use indexed field operations if available
    // This queries AccountAsset entities where principalToken_id = futureId
    const accountAssets = await context.AccountAsset.getWhere.principalToken_id.eq(futureId);
    
    if (accountAssets && Array.isArray(accountAssets)) {
      // Filter by generatedYield = true and update yield for each
      for (const accountAsset of accountAssets) {
        if (accountAsset.generatedYield === true && accountAsset.account_id) {
          // Extract account address from account_id (remove chainId prefix)
          const accountAddress = accountAsset.account_id.replace(`${chainId}-`, "");
          
          // Update yield account asset balance
          await updateYieldAccountAssetBalance(
            normalizedPrincipalTokenAddress,
            accountAddress,
            timestamp,
            chainId,
            blockNumber,
            context
          );
        }
      }
    }
  } catch (error) {
    // If indexed field operations are not available, log warning and skip
    // This is a limitation - we can't efficiently query by relationship fields in Envio
    context.log.warn(`updateYieldForAll: Could not query AccountAsset by principalToken_id for ${futureId}: ${String(error)}`);
  }
}
