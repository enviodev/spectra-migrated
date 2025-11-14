// Reference: spectra-subgraph-master/src/entities/CurvePool.ts
// Effect for fetching pool last prices from CurvePool contract

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_BI } from "../constants";
import { PoolType } from "../utils/PoolType";

// Minimal ABI for CurvePool functions
const CURVE_POOL_ABI = parseAbi([
  "function last_prices() view returns (uint256)",
]);

// Minimal ABI for CurvePoolSNG functions
const CURVE_POOL_SNG_ABI = parseAbi([
  "function last_price(uint256) view returns (uint256)",
  "function stored_rates() view returns (uint256[2])",
]);

/**
 * Effect to fetch pool last prices from a CurvePool contract
 * Uses viem for contract state reading
 */
export const getPoolLastPrices = createEffect(
  {
    name: "getPoolLastPrices",
    input: {
      poolAddress: S.string,
      poolType: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      lastPrice: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return { lastPrice: ZERO_BI.toString() };
      }

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

      const poolAddress = input.poolAddress as `0x${string}`;

      if (input.poolType === PoolType.CURVE_SNG) {
        // For CURVE_SNG: call last_price(0) and stored_rates()
        const [lastPrice, storedRates] = await Promise.all([
          publicClient.readContract({
            address: poolAddress,
            abi: CURVE_POOL_SNG_ABI,
            functionName: "last_price",
            args: [BigInt(0)],
          }).catch((err) => {
            console.warn(`last_price() failed for ${input.poolAddress}:`, err.message);
            return BigInt(0);
          }),
          publicClient.readContract({
            address: poolAddress,
            abi: CURVE_POOL_SNG_ABI,
            functionName: "stored_rates",
          }).catch((err) => {
            console.warn(`stored_rates() failed for ${input.poolAddress}:`, err.message);
            return [BigInt(0), BigInt(0)] as [bigint, bigint];
          }),
        ]);

        // Calculate: storedRates[1] * lastPrice / storedRates[0]
        if (storedRates[0] > BigInt(0)) {
          const calculatedPrice = (storedRates[1] * lastPrice) / storedRates[0];
          return { lastPrice: calculatedPrice.toString() };
        }
        return { lastPrice: ZERO_BI.toString() };
      } else {
        // For CURVE/CURVE_NG: call last_prices()
        const lastPrices = await publicClient.readContract({
          address: poolAddress,
          abi: CURVE_POOL_ABI,
          functionName: "last_prices",
        }).catch((err) => {
          console.warn(`last_prices() failed for ${input.poolAddress}:`, err.message);
          return BigInt(0);
        });

        return { lastPrice: lastPrices.toString() };
      }
    } catch (error) {
      console.warn(`getPoolLastPrices() call failed for ${input.poolAddress}:`, error);
      return { lastPrice: ZERO_BI.toString() };
    }
  }
);

