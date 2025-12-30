// Reference: spectra-subgraph-master/src/entities/FutureVault.ts
// Effect for fetching PrincipalToken contract data

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_ADDRESS, ZERO_BI, UNIT_BI } from "../constants";

// Minimal ABI for PrincipalToken functions
const PRINCIPAL_TOKEN_ABI = parseAbi([
  "function maturity() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function underlying() view returns (address)",
  "function getIBT() view returns (address)",
  "function getYT() view returns (address)",
  "function getPTRate() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function getCurrentYieldOfUserInIBT(address) view returns (uint256)",
]);

/**
 * Effect to fetch PrincipalToken contract data
 * Uses viem for contract state reading
 */
export const getPrincipalTokenData = createEffect(
  {
    name: "getPrincipalTokenData",
    input: {
      ptAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      maturity: S.string,
      name: S.string,
      symbol: S.string,
      decimals: S.number,
      underlying: S.string,
      ibt: S.string,
      yt: S.string,
      ptRate: S.string,
      totalAssets: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input, context }) => {
    try {
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        context.log.warn(`No RPC URL found for chain ${input.chainId}`);
        // Return default values on error
        return {
          maturity: "0",
          name: "",
          symbol: "",
          decimals: 18,
          underlying: ZERO_ADDRESS,
          ibt: ZERO_ADDRESS,
          yt: ZERO_ADDRESS,
          ptRate: UNIT_BI.toString(),
          totalAssets: "0",
        };
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

      // Read all contract state in parallel
      // Note: These calls may fail if the address is not a contract or doesn't exist
      // This is expected behavior - we catch errors and return default values
      // Original subgraph logs warnings but continues execution
      // ERC20 metadata (name, symbol, decimals) are typically immutable, so we query at latest block
      const [maturity, name, symbol, decimals, underlying, ibt, yt, ptRate, totalAssets] = await Promise.all([
        publicClient.readContract({
          address: input.ptAddress as `0x${string}`,
          abi: PRINCIPAL_TOKEN_ABI,
          functionName: "maturity",
          blockNumber: BigInt(input.blockNumber),
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          context.log.warn(`maturity() call reverted for ${input.ptAddress}`);
          return BigInt(0);
        }),
        publicClient.readContract({
          address: input.ptAddress as `0x${string}`,
          abi: PRINCIPAL_TOKEN_ABI,
          functionName: "name",
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          context.log.warn(`name() call reverted for ${input.ptAddress}`);
          return "";
        }),
        publicClient.readContract({
          address: input.ptAddress as `0x${string}`,
          abi: PRINCIPAL_TOKEN_ABI,
          functionName: "symbol",
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          context.log.warn(`symbol() call reverted for ${input.ptAddress}`);
          return "";
        }),
        publicClient.readContract({
          address: input.ptAddress as `0x${string}`,
          abi: PRINCIPAL_TOKEN_ABI,
          functionName: "decimals",
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          context.log.warn(`decimals() call reverted for ${input.ptAddress}`);
          return 18;
        }),
        publicClient.readContract({
          address: input.ptAddress as `0x${string}`,
          abi: PRINCIPAL_TOKEN_ABI,
          functionName: "underlying",
          blockNumber: BigInt(input.blockNumber),
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          context.log.warn(`underlying() call reverted for ${input.ptAddress}`);
          return "0x0000000000000000000000000000000000000000";
        }),
        publicClient.readContract({
          address: input.ptAddress as `0x${string}`,
          abi: PRINCIPAL_TOKEN_ABI,
          functionName: "getIBT",
          blockNumber: BigInt(input.blockNumber),
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          context.log.warn(`getIBT() call reverted for ${input.ptAddress}`);
          return "0x0000000000000000000000000000000000000000";
        }),
        publicClient.readContract({
          address: input.ptAddress as `0x${string}`,
          abi: PRINCIPAL_TOKEN_ABI,
          functionName: "getYT",
          blockNumber: BigInt(input.blockNumber),
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          context.log.warn(`getYT() call reverted for ${input.ptAddress}`);
          return "0x0000000000000000000000000000000000000000";
        }),
        publicClient.readContract({
          address: input.ptAddress as `0x${string}`,
          abi: PRINCIPAL_TOKEN_ABI,
          functionName: "getPTRate",
          blockNumber: BigInt(input.blockNumber),
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          context.log.warn(`getPTRate() call reverted for ${input.ptAddress}`);
          return UNIT_BI;
        }),
        publicClient.readContract({
          address: input.ptAddress as `0x${string}`,
          abi: PRINCIPAL_TOKEN_ABI,
          functionName: "totalAssets",
          blockNumber: BigInt(input.blockNumber),
        }).catch((err) => {
          // Log warning when RPC call fails (matches original subgraph)
          context.log.warn(`totalAssets() call reverted for ${input.ptAddress}`);
          return BigInt(0);
        }),
      ]);

      // Format result matching test script output
      return {
        maturity: maturity.toString(),
        name: (name as string) || "",
        symbol: (symbol as string) || "",
        decimals: Number(decimals) || 18,
        underlying: (underlying as string),
        ibt: (ibt as string),
        yt: (yt as string),
        ptRate: ptRate.toString(),
        totalAssets: totalAssets.toString(),
      };
    } catch (error) {
      // Log warning and return default values (matches original subgraph pattern)
      context.log.warn(`getPrincipalTokenData() call failed for ${input.ptAddress}: ${String(error)}`);
      return {
        maturity: "0",
        name: "",
        symbol: "",
        decimals: 18,
        underlying: ZERO_ADDRESS,
        ibt: ZERO_ADDRESS,
        yt: ZERO_ADDRESS,
        ptRate: UNIT_BI.toString(),
        totalAssets: "0",
      };
    }
  }
);

