// Reference: spectra-subgraph-master/src/entities/Factory.ts
// Effect for fetching curveFactory address from Factory contract

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_ADDRESS } from "../constants";

// Minimal ABI for getCurveFactory function
const FACTORY_ABI = parseAbi([
  "function getCurveFactory() view returns (address)",
]);

/**
 * Effect to fetch curveFactory address from a Factory contract
 * Uses viem for contract state reading
 */
export const getCurveFactory = createEffect(
  {
    name: "getCurveFactory",
    input: {
      factoryAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.nullable(S.string),
    rateLimit: false,
    cache: true,
  },
  async ({ input, context }) => {
    try {
      // Get RPC URL from environment (should be set per chain)
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        context.log.warn(`No RPC URL found for chain ${input.chainId}`);
        return ZERO_ADDRESS;
      }

      // Create public client for this chain
      // Minimal chain definition for viem
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

      // Read contract state using viem
      const curveFactory = await publicClient.readContract({
        address: input.factoryAddress as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: "getCurveFactory",
        blockNumber: BigInt(input.blockNumber),
      });

      return (curveFactory as string);
    } catch (error) {
      context.log.warn(`getCurveFactory() call failed for ${input.factoryAddress}: ${String(error)}`);
      return ZERO_ADDRESS;
    }
  }
);
