// TODO: Add helper functions from original subgraph
// Reference: spectra-subgraph-master/src/utils/idGenerators.ts

// FYTTokenDetails
export const generateFYTInfoId = (tokenAddress: string): string =>
    `${tokenAddress}-FYT`

// LiquidityTokenDetails
export const generateLPInfoId = (tokenAddress: string): string =>
    `${tokenAddress}-LP`

// AssetAmount
export const generateAssetAmountId = (
    transactionHash: string,
    assetAddress: string,
    logIndex: string,
    type: string
): string => `${transactionHash}-${assetAddress}-${type}-${logIndex}`

// AssetPrice
export const generateAssetPriceId = (
    tokenAddress: string,
    timestamp: string
): string => `${timestamp}-${tokenAddress}`

// AccountAsset
export const generateAccountAssetId = (
    accountAddress: string,
    assetAddress: string,
    prefix: string = ""
): string => `${prefix}${accountAddress}-${assetAddress}`

// Fees
export const generateFeeClaimId = (
    collectorAddress: string,
    timestamp: string
): string => `${timestamp}-${collectorAddress}`

// Transfer
export const generateTransferId = (
    transactionHash: string,
    timestamp: string,
    logIndex: string
): string => `${timestamp}-${transactionHash}-${logIndex}`

// FutureDailyStats
export const generateFutureDailyStatsId = (
    futureAddress: string,
    dayId: string
): string => `${futureAddress}-${dayId}`

// PoolStats
export const generatePoolStatsId = (
    poolAddress: string,
    span: string,
    statId: string
): string => `${poolAddress}-S-${span}-${statId}`

export const generateTransactionId = (
    transactionHash: string,
    eventIterator: string
): string => `${transactionHash}-${eventIterator}`

export const generateYieldAssetId = (principalToken: string): string =>
    `${principalToken}-yield`

export const generateClaimedYieldAssetId = (principalToken: string): string =>
    `${principalToken}-claimed-yield`

