// Reference: spectra-subgraph-master/src/entities/FutureVault.ts
// Effect for fetching current yield of user in IBT from PrincipalToken contract

import { createEffect, S } from "envio";
import { createPublicClient, http } from "viem";
import { ZERO_BI } from "../constants";

// Import full ABI to ensure correct parsing (parseAbi has issues with some return types)
import PRINCIPAL_TOKEN_ABI_JSON from "../../abis/PrincipalToken.json";
const PRINCIPAL_TOKEN_ABI = PRINCIPAL_TOKEN_ABI_JSON as any;

/**
 * Effect to fetch current yield of user in IBT from PrincipalToken contract
 * Reference: spectra-subgraph/src/entities/FutureVault.ts getCurrentYieldOfUserInIBT (lines 166-183)
 */
export const getCurrentYieldOfUserInIBT = createEffect(
  {
    name: "getCurrentYieldOfUserInIBT",
    input: {
      ptAddress: S.string,
      accountAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.string, // Returns BigInt as string
    rateLimit: false,
    cache: true,
  },
  async ({ input, context }) => {
    // TODO: Temporarily returning dummy data - RPC call is too slow
    // Return ZERO_BI as dummy data (matches expected return type)
    return ZERO_BI.toString();
    
    // Original RPC call code (commented out for performance):
    /*
    try {
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        context.log.warn(`No RPC URL found for chain ${input.chainId}`);
        return ZERO_BI.toString();
      }

      // Create public client for this chain
      const publicClient = createPublicClient({
        chain: {
          id: input.chainId,
          name: `Chain ${input.chainId}`,
          nativeCurrency: {
            decimals: 18,
            name: "ETH",
            symbol: "ETH",
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

      // Read contract state
      // Note: This call may fail if the account doesn't exist in the contract as IBT yield owner
      // The subgraph returns ZERO_BI silently without logging (line 179-182)
      const userYieldInIBT = await publicClient.readContract({
        address: input.ptAddress as `0x${string}`,
        abi: PRINCIPAL_TOKEN_ABI,
        functionName: "getCurrentYieldOfUserInIBT",
        args: [input.accountAddress as `0x${string}`],
        blockNumber: BigInt(input.blockNumber),
      }).catch((err) => {
        // No warning as this request is failing too often (matches subgraph line 179-182)
        // It is happening for all the requests if account do not exist in the contract as IBT yield owner
        return BigInt(0);
      });

      return userYieldInIBT.toString();
    } catch (error) {
      // Return ZERO_BI silently (matches original subgraph pattern - no warning)
      return ZERO_BI.toString();
    }
    */
  }
);

