// TODO: Add helper functions from original subgraph
// Reference: spectra-subgraph-master/src/utils/ChainId.ts

export const ChainId = {
    mainnet: 1,
    goerli: 5,
    sepolia: 11155111,
    arbitrum: 42161,
    sonic: 146,
    base: 8453,
    optimism: 10,
    hemi: 43111,
    avalanche: 43114,
    bsc: 56,
    hyperevm: 999,
    katana: 747474,
    flare: 14,
}

export function getChainId(network: string): number {
    // Match original: maps network names to chain IDs
    if (network === "mainnet") {
        return ChainId.mainnet;
    } else if (network === "goerli") {
        return ChainId.goerli;
    } else if (network === "sepolia") {
        return ChainId.sepolia;
    } else if (network === "arbitrum-one") {
        return ChainId.arbitrum;
    } else if (network === "sonic-mainnet") {
        return ChainId.sonic;
    } else if (network === "base") {
        return ChainId.base;
    } else if (network === "optimism") {
        return ChainId.optimism;
    } else if (network === "spectra-hemi") {
        return ChainId.hemi;
    } else if (network === "avalanche") {
        return ChainId.avalanche;
    } else if (network === "bsc") {
        return ChainId.bsc;
    } else if (network === "hyperevm") {
        return ChainId.hyperevm;
    } else if (network === "katana") {
        return ChainId.katana;
    } else if (network === "flare") {
        return ChainId.flare;
    }
    throw new Error(`Unsupported network: ${network}`);
}

