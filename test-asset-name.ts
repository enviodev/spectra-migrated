/**
 * Test script to query asset name and symbol for a specific address
 * This helps verify if the name/symbol should be "UNKNOWN" or if there's an issue with our RPC calls
 */

import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import * as dotenv from "dotenv";
dotenv.config();

// Address to test
const ASSET_ADDRESS = "0x34ee2e930f4f70a1070b4077ca1b01e0cb881dcd" as `0x${string}`;
// Use a recent block number (or remove blockNumber to use latest)
const BLOCK_NUMBER = undefined; // Set to a specific block number if needed, or undefined for latest

// ERC20 ABI
const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

async function testAssetName() {
  const rpcUrl = process.env.RPC_URL || process.env.ENVIO_RPC_URL_1;
  if (!rpcUrl) {
    console.error("Please set RPC_URL or ENVIO_RPC_URL_1 environment variable");
    process.exit(1);
  }

  console.log(`\n=== Testing Asset Name/Symbol for ${ASSET_ADDRESS} ===\n`);

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { batch: true }),
  });

  try {
    // Step 1: Try to get name
    console.log("Step 1: Getting name...");
    try {
      const name = await publicClient.readContract({
        address: ASSET_ADDRESS,
        abi: ERC20_ABI,
        functionName: "name",
        blockNumber: BLOCK_NUMBER,
      });
      console.log(`  ✅ name(): "${name}"`);
    } catch (error: any) {
      console.log(`  ❌ name() failed: ${error.message}`);
      if (error.shortMessage) {
        console.log(`     Short message: ${error.shortMessage}`);
      }
      if (error.cause) {
        console.log(`     Cause: ${error.cause}`);
      }
    }

    // Step 2: Try to get symbol
    console.log("\nStep 2: Getting symbol...");
    try {
      const symbol = await publicClient.readContract({
        address: ASSET_ADDRESS,
        abi: ERC20_ABI,
        functionName: "symbol",
        blockNumber: BLOCK_NUMBER,
      });
      console.log(`  ✅ symbol(): "${symbol}"`);
    } catch (error: any) {
      console.log(`  ❌ symbol() failed: ${error.message}`);
      if (error.shortMessage) {
        console.log(`     Short message: ${error.shortMessage}`);
      }
      if (error.cause) {
        console.log(`     Cause: ${error.cause}`);
      }
    }

    // Step 3: Try to get decimals
    console.log("\nStep 3: Getting decimals...");
    try {
      const decimals = await publicClient.readContract({
        address: ASSET_ADDRESS,
        abi: ERC20_ABI,
        functionName: "decimals",
        blockNumber: BLOCK_NUMBER,
      });
      console.log(`  ✅ decimals(): ${decimals}`);
    } catch (error: any) {
      console.log(`  ❌ decimals() failed: ${error.message}`);
      if (error.shortMessage) {
        console.log(`     Short message: ${error.shortMessage}`);
      }
      if (error.cause) {
        console.log(`     Cause: ${error.cause}`);
      }
    }

    // Step 4: Check if it's a contract
    console.log("\nStep 4: Checking if address is a contract...");
    try {
      const code = await publicClient.getBytecode({
        address: ASSET_ADDRESS,
        blockNumber: BLOCK_NUMBER,
      });
      if (code && code !== "0x") {
        console.log(`  ✅ Address is a contract (has bytecode)`);
      } else {
        console.log(`  ⚠️  Address is not a contract (no bytecode)`);
      }
    } catch (error: any) {
      console.log(`  ❌ getBytecode() failed: ${error.message}`);
    }

    // Step 5: Comparison
    console.log("\n=== Comparison ===");
    console.log(`  Expected (from subgraph):`);
    console.log(`    name: "Principal Token: ysWETH-174..."`);
    console.log(`    symbol: "PT-ysWETH-1745193625"`);
    console.log(`  Our result: See above`);
    console.log(`\n  If name()/symbol() returned values, they should match the subgraph.`);
    console.log(`  If they returned errors, that explains why we're getting "UNKNOWN".`);

  } catch (error: any) {
    console.error("\n❌ Unexpected error:", error.message);
    if (error.shortMessage) {
      console.error("   Short message:", error.shortMessage);
    }
    if (error.cause) {
      console.error("   Cause:", error.cause);
    }
    process.exit(1);
  }
}

testAssetName();

