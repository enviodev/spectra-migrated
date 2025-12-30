// Reference: spectra-subgraph-master/src/entities/ERC4626.ts
// Effect for fetching IBT rate (convertToAssets with 1 unit of shares)

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { UNIT_BI } from "../constants";
import { getERC20Decimals } from "../entities/ERC20";

// Minimal ABI for ERC4626 convertToAssets function
const ERC4626_ABI = parseAbi([
  "function convertToAssets(uint256 shares) view returns (uint256)",
]);

/**
 * Effect to fetch IBT rate (convertToAssets with 10^decimals shares)
 * Uses viem for contract state reading
 */
export const getIBTRate = createEffect(
  {
    name: "getIBTRate",
    input: {
      ibtAddress: S.string,
      decimals: S.number,
      chainId: S.number,
      blockNumber: S.number,
      symbol: S.string,
      transactionHash: S.string,
      logIndex: S.string,
    },
    output: S.schema({
      ibtRate: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input, context }) => {
    try {
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        context.log.warn(`No RPC URL found for chain ${input.chainId}`);
        return { ibtRate: UNIT_BI.toString() };
      }
      if (input.symbol === "UNKNOWN") {
        context.log.warn(`Symbol is UNKNOWN for ${input.ibtAddress}`);
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

      const ibtAddress = input.ibtAddress as `0x${string}`;

      let ibtUnit = Math.pow(10, input.decimals);

      const ibtRate = await publicClient.readContract({
        address: ibtAddress,
        abi: ERC4626_ABI,
        functionName: "convertToAssets",
        args: [BigInt(ibtUnit)],
        blockNumber: BigInt(input.blockNumber),
      });

      // Target transaction entity ID: 1-0x001edc41512d1e03d00676b52cb22ae50bd595affd057f4a201a8998cf888e81-706
      const targetTxHash = "0x001edc41512d1e03d00676b52cb22ae50bd595affd057f4a201a8998cf888e81";
      const targetLogIndex = "706";
      
      const shouldLog = input.transactionHash?.toLowerCase() === targetTxHash.toLowerCase() && 
                        input.logIndex === targetLogIndex;

      if (shouldLog) {
        context.log.info(`Address: ${ibtAddress},
        IBT Unit: ${ibtUnit},
        Block Number: ${input.blockNumber},
        Chain ID: ${input.chainId},
        Symbol: ${input.symbol},
        Decimals: ${input.decimals},
        IBT Rate: ${ibtRate.toString()}`);
      }

      return { ibtRate: ibtRate.toString() };
    } catch (error: any) {
      // Contract function reverted - this is expected for some addresses
      // Reference: subgraph line 18 - log.warning and return UNIT_BI
      // Check if it's a contract revert (expected) vs other error (unexpected)
      const isContractRevert = 
        error?.shortMessage?.includes("reverted") ||
        error?.cause?.shortMessage?.includes("reverted") ||
        error?.message?.includes("reverted");
      
      if (isContractRevert) {
        // Silently handle expected reverts (non-ERC4626 contracts, etc.)
        // This matches subgraph behavior - it logs a warning but continues
        // We return UNIT_BI without logging to reduce noise
        return { ibtRate: UNIT_BI.toString() };
      }
      
      // Log unexpected errors (RPC issues, network problems, etc.)
      context.log.warn(`getIBTRate() unexpected error for ${input.ibtAddress}: ${String(error)}`);
      return { ibtRate: UNIT_BI.toString() };
    }
  }
);

