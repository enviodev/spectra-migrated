// TODO: Add helper functions from original subgraph
// Reference: spectra-subgraph-master/src/utils/idGenerators.ts

// FYTTokenDetails
export const generateFYTInfoId = (tokenAddress: string): string =>
    `${tokenAddress.toLowerCase()}-FYT`

// LiquidityTokenDetails
export const generateLPInfoId = (tokenAddress: string): string =>
    `${tokenAddress.toLowerCase()}-LP`

// AssetAmount
export const generateAssetAmountId = (
    transactionHash: string,
    assetAddress: string,
    logIndex: string,
    type: string
): string => `${transactionHash}-${assetAddress.toLowerCase()}-${type}-${logIndex}`

// AssetPrice
export const generateAssetPriceId = (
    tokenAddress: string,
    timestamp: string
): string => `${timestamp}-${tokenAddress.toLowerCase()}`

// AccountAsset
export const generateAccountAssetId = (
    accountAddress: string,
    assetAddress: string,
    prefix: string = ""
): string => `${prefix}${accountAddress.toLowerCase()}-${assetAddress.toLowerCase()}`

// Fees
export const generateFeeClaimId = (
    collectorAddress: string,
    timestamp: string
): string => `${timestamp}-${collectorAddress.toLowerCase()}`

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
): string => `${futureAddress.toLowerCase()}-${dayId}`

// PoolStats
export const generatePoolStatsId = (
    poolAddress: string,
    span: string,
    statId: string
): string => `${poolAddress.toLowerCase()}-S-${span}-${statId}`

export const generateTransactionId = (
    transactionHash: string,
    eventIterator: string
): string => `${transactionHash}-${eventIterator}`

export const generateYieldAssetId = (principalToken: string): string =>
    `${principalToken.toLowerCase()}-yield`

export const generateClaimedYieldAssetId = (principalToken: string): string =>
    `${principalToken.toLowerCase()}-claimed-yield`

