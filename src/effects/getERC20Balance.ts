// Reference: spectra-subgraph-master/src/entities/ERC20.ts
// Effect to fetch ERC20 token balance

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";

// Minimal ABI for ERC20 balanceOf function
const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

/**
 * Effect to fetch ERC20 token balance
 * Uses viem for contract state reading
 */
export const getERC20Balance = createEffect(
  {
    name: "getERC20Balance",
    input: {
      tokenAddress: S.string,
      accountAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      balance: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return { balance: "0" };
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
      const accountAddress = input.accountAddress as `0x${string}`;

      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [accountAddress],
      }).catch(() => BigInt(0));

      return {
        balance: String(balance),
      };
    } catch (error) {
      console.error(`getERC20Balance() call failed for ${input.tokenAddress}: ${error}`);
      return { balance: "0" };
    }
  }
);

