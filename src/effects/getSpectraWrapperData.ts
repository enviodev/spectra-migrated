// Reference: spectra-subgraph-master/src/entities/SpectraWrapper.ts
// Effect to fetch SpectraWrapper contract data

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";

// Minimal ABI for Spectra4626Wrapper functions
const SPECTRA_WRAPPER_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function vaultShare() view returns (address)",
  "function asset() view returns (address)",
]);

/**
 * Effect to fetch SpectraWrapper contract data
 * Uses viem for contract state reading
 */
export const getSpectraWrapperData = createEffect(
  {
    name: "getSpectraWrapperData",
    input: {
      wrapperAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      name: S.string,
      symbol: S.string,
      decimals: S.number,
      vaultShare: S.string,
      vaultShareName: S.string,
      vaultShareSymbol: S.string,
      vaultShareDecimals: S.number,
      asset: S.string,
      assetName: S.string,
      assetSymbol: S.string,
      assetDecimals: S.number,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        // Return default values on error
        return {
          name: "UNKNOWN",
          symbol: "UNKNOWN",
          decimals: 18,
          vaultShare: "",
          vaultShareName: "UNKNOWN",
          vaultShareSymbol: "UNKNOWN",
          vaultShareDecimals: 18,
          asset: "",
          assetName: "UNKNOWN",
          assetSymbol: "UNKNOWN",
          assetDecimals: 18,
        };
      }

      const publicClient = createPublicClient({
        chain: {
          id: input.chainId,
          name: `Chain ${input.chainId}`,
          nativeCurrency: {
            name: "ETH",
            symbol: "ETH",
            decimals: 18,
          },
          rpcUrls: {
            default: {
              http: [rpcUrl],
            },
            public: {
              http: [rpcUrl],
            },
          },
        },
        transport: http(rpcUrl, { batch: true }),
      });

      const wrapperAddress = input.wrapperAddress as `0x${string}`;

      // Read wrapper contract data
      const [name, symbol, decimals, vaultShare, asset] = await Promise.all([
        publicClient.readContract({
          address: wrapperAddress,
          abi: SPECTRA_WRAPPER_ABI,
          functionName: "name",
        }).catch(() => "UNKNOWN"),
        publicClient.readContract({
          address: wrapperAddress,
          abi: SPECTRA_WRAPPER_ABI,
          functionName: "symbol",
        }).catch(() => "UNKNOWN"),
        publicClient.readContract({
          address: wrapperAddress,
          abi: SPECTRA_WRAPPER_ABI,
          functionName: "decimals",
        }).catch(() => 18),
        publicClient.readContract({
          address: wrapperAddress,
          abi: SPECTRA_WRAPPER_ABI,
          functionName: "vaultShare",
        }).catch(() => null),
        publicClient.readContract({
          address: wrapperAddress,
          abi: SPECTRA_WRAPPER_ABI,
          functionName: "asset",
        }).catch(() => null),
      ]);

      // Fetch vault share and asset ERC20 data if available
      const [vaultShareName, vaultShareSymbol, vaultShareDecimals, assetName, assetSymbol, assetDecimals] = await Promise.all([
        vaultShare ? publicClient.readContract({
          address: vaultShare as `0x${string}`,
          abi: parseAbi(["function name() view returns (string)"]),
          functionName: "name",
        }).catch(() => "UNKNOWN") : Promise.resolve("UNKNOWN"),
        vaultShare ? publicClient.readContract({
          address: vaultShare as `0x${string}`,
          abi: parseAbi(["function symbol() view returns (string)"]),
          functionName: "symbol",
        }).catch(() => "UNKNOWN") : Promise.resolve("UNKNOWN"),
        vaultShare ? publicClient.readContract({
          address: vaultShare as `0x${string}`,
          abi: parseAbi(["function decimals() view returns (uint8)"]),
          functionName: "decimals",
        }).catch(() => 18) : Promise.resolve(18),
        asset ? publicClient.readContract({
          address: asset as `0x${string}`,
          abi: parseAbi(["function name() view returns (string)"]),
          functionName: "name",
        }).catch(() => "UNKNOWN") : Promise.resolve("UNKNOWN"),
        asset ? publicClient.readContract({
          address: asset as `0x${string}`,
          abi: parseAbi(["function symbol() view returns (string)"]),
          functionName: "symbol",
        }).catch(() => "UNKNOWN") : Promise.resolve("UNKNOWN"),
        asset ? publicClient.readContract({
          address: asset as `0x${string}`,
          abi: parseAbi(["function decimals() view returns (uint8)"]),
          functionName: "decimals",
        }).catch(() => 18) : Promise.resolve(18),
      ]);

      return {
        name: (name as string) || "UNKNOWN",
        symbol: (symbol as string) || "UNKNOWN",
        decimals: Number(decimals) || 18,
        vaultShare: vaultShare ? String(vaultShare) : "",
        vaultShareName: (vaultShareName as string) || "UNKNOWN",
        vaultShareSymbol: (vaultShareSymbol as string) || "UNKNOWN",
        vaultShareDecimals: Number(vaultShareDecimals) || 18,
        asset: asset ? String(asset) : "",
        assetName: (assetName as string) || "UNKNOWN",
        assetSymbol: (assetSymbol as string) || "UNKNOWN",
        assetDecimals: Number(assetDecimals) || 18,
      };
    } catch (error) {
      console.error(`getSpectraWrapperData() call failed for ${input.wrapperAddress}: ${error}`);
      // Return default values on error
      return {
        name: "UNKNOWN",
        symbol: "UNKNOWN",
        decimals: 18,
        vaultShare: "",
        vaultShareName: "UNKNOWN",
        vaultShareSymbol: "UNKNOWN",
        vaultShareDecimals: 18,
        asset: "",
        assetName: "UNKNOWN",
        assetSymbol: "UNKNOWN",
        assetDecimals: 18,
      };
    }
  }
);

