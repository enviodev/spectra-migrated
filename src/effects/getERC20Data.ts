// Reference: spectra-subgraph-master/src/entities/ERC20.ts
// Effect to fetch ERC20 token data (name, symbol, decimals)

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";

// Minimal ABI for ERC20 functions
const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

/**
 * Effect to fetch ERC20 token data
 * Uses viem for contract state reading
 */
export const getERC20Data = createEffect(
  {
    name: "getERC20Data",
    input: {
      tokenAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      name: S.string,
      symbol: S.string,
      decimals: S.number,
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
          name: "UNKNOWN",
          symbol: "UNKNOWN",
          decimals: 18,
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

      const tokenAddress = input.tokenAddress as `0x${string}`;

      // Read all contract data in parallel
      // Note: These calls may fail if the address is not a contract or doesn't exist
      // We log warnings when they fail (matching original subgraph pattern)
      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "name",
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          console.warn(`name() call (string or bytes) reverted for ${input.tokenAddress}`);
          return "UNKNOWN";
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "symbol",
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          console.warn(`symbol() call (string or bytes) reverted for ${input.tokenAddress}`);
          return "UNKNOWN";
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          console.warn(`decimals() call (number) reverted for ${input.tokenAddress}`);
          return 18;
        }),
      ]);

      return {
        name: (name as string) || "UNKNOWN",
        symbol: (symbol as string) || "UNKNOWN",
        decimals: Number(decimals) || 18,
      };
    } catch (error) {
      // Log warning and return default values (matches original subgraph pattern)
      console.warn(`getERC20Data() call failed for ${input.tokenAddress}:`, error);
      return {
        name: "UNKNOWN",
        symbol: "UNKNOWN",
        decimals: 18,
      };
    }
  }
);

