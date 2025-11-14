// Reference: spectra-subgraph-master/src/entities/Metavault.ts
// Effect to fetch MetavaultWrapper contract data

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";

// Minimal ABI for MetavaultWrapper functions
const METAVAULT_WRAPPER_ABI = parseAbi([
  "function owner() view returns (address)",
  "function getInfraVault() view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function asset() view returns (address)",
]);

/**
 * Effect to fetch MetavaultWrapper contract data
 * Uses viem for contract state reading
 */
export const getMetavaultWrapperData = createEffect(
  {
    name: "getMetavaultWrapperData",
    input: {
      wrapperAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      owner: S.string,
      infravaultAddress: S.string,
      name: S.string,
      symbol: S.string,
      decimals: S.number,
      asset: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        // Return default values on error
        return {
          owner: "",
          infravaultAddress: "",
          name: "",
          symbol: "",
          decimals: 0,
          asset: "",
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
          },
        },
        transport: http(rpcUrl, { batch: true }),
      });

      const wrapperAddress = input.wrapperAddress as `0x${string}`;

      // Read all contract data in parallel
      const [owner, infravaultAddress, name, symbol, decimals, asset] = await Promise.all([
        publicClient.readContract({
          address: wrapperAddress,
          abi: METAVAULT_WRAPPER_ABI,
          functionName: "owner",
        }),
        publicClient.readContract({
          address: wrapperAddress,
          abi: METAVAULT_WRAPPER_ABI,
          functionName: "getInfraVault",
        }),
        publicClient.readContract({
          address: wrapperAddress,
          abi: METAVAULT_WRAPPER_ABI,
          functionName: "name",
        }),
        publicClient.readContract({
          address: wrapperAddress,
          abi: METAVAULT_WRAPPER_ABI,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: wrapperAddress,
          abi: METAVAULT_WRAPPER_ABI,
          functionName: "decimals",
        }),
        publicClient.readContract({
          address: wrapperAddress,
          abi: METAVAULT_WRAPPER_ABI,
          functionName: "asset",
        }),
      ]);

      return {
        owner: String(owner),
        infravaultAddress: String(infravaultAddress),
        name: String(name),
        symbol: String(symbol),
        decimals: Number(decimals),
        asset: String(asset),
      };
    } catch (error) {
      console.error(`getMetavaultWrapperData() call failed for ${input.wrapperAddress}: ${error}`);
      // Return default values on error
      return {
        owner: "",
        infravaultAddress: "",
        name: "",
        symbol: "",
        decimals: 0,
        asset: "",
      };
    }
  }
);

