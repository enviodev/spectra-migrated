// Reference: spectra-subgraph-master/src/entities/Metavault.ts
// Effect to check if an infravault is an AmphorAsyncVault

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";

// Minimal ABI for AmphorAsyncVault functions
const AMPHOR_ASYNC_VAULT_ABI = parseAbi([
  "function pendingSilo() view returns (address)",
  "function claimableSilo() view returns (address)",
  "function epochId() view returns (uint256)",
]);

/**
 * Effect to check if an infravault is an AmphorAsyncVault
 * Checks if pendingSilo, claimableSilo, and epochId calls succeed
 */
export const checkAmphorAsyncVault = createEffect(
  {
    name: "checkAmphorAsyncVault",
    input: {
      infravaultAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      isAmphorAsyncVault: S.boolean,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return { isAmphorAsyncVault: false };
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

      const infravaultAddress = input.infravaultAddress as `0x${string}`;

      // Check all three functions in parallel
      // If all succeed, it's an AmphorAsyncVault
      const [pendingSilo, claimableSilo, epochId] = await Promise.all([
        publicClient.readContract({
          address: infravaultAddress,
          abi: AMPHOR_ASYNC_VAULT_ABI,
          functionName: "pendingSilo",
        }).catch(() => null),
        publicClient.readContract({
          address: infravaultAddress,
          abi: AMPHOR_ASYNC_VAULT_ABI,
          functionName: "claimableSilo",
        }).catch(() => null),
        publicClient.readContract({
          address: infravaultAddress,
          abi: AMPHOR_ASYNC_VAULT_ABI,
          functionName: "epochId",
        }).catch(() => null),
      ]);

      // If all three calls succeeded, it's an AmphorAsyncVault
      const isAmphorAsyncVault = pendingSilo !== null && claimableSilo !== null && epochId !== null;

      return { isAmphorAsyncVault };
    } catch (error) {
      console.error(`checkAmphorAsyncVault() call failed for ${input.infravaultAddress}: ${error}`);
      return { isAmphorAsyncVault: false };
    }
  }
);

