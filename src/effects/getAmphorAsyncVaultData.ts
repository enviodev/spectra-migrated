// Reference: spectra-subgraph-master/src/mappings/metavaults/amphorAsyncVault.ts
// Effect to fetch AmphorAsyncVault contract data

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";

// Minimal ABI for AmphorAsyncVault functions
const AMPHOR_ASYNC_VAULT_ABI = parseAbi([
  "function epochId() view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

/**
 * Effect to fetch AmphorAsyncVault contract data
 * Uses viem for contract state reading
 */
export const getAmphorAsyncVaultData = createEffect(
  {
    name: "getAmphorAsyncVaultData",
    input: {
      vaultAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      epochId: S.string,
      decimals: S.number,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return {
          epochId: "0",
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

      const vaultAddress = input.vaultAddress as `0x${string}`;

      // Read contract data
      const [epochId, decimals] = await Promise.all([
        publicClient.readContract({
          address: vaultAddress,
          abi: AMPHOR_ASYNC_VAULT_ABI,
          functionName: "epochId",
        }).catch(() => BigInt(0)),
        publicClient.readContract({
          address: vaultAddress,
          abi: AMPHOR_ASYNC_VAULT_ABI,
          functionName: "decimals",
        }).catch(() => 18),
      ]);

      return {
        epochId: String(epochId),
        decimals: Number(decimals) || 18,
      };
    } catch (error) {
      console.error(`getAmphorAsyncVaultData() call failed for ${input.vaultAddress}: ${error}`);
      return {
        epochId: "0",
        decimals: 18,
      };
    }
  }
);

