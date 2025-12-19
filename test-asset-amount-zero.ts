/**
 * Test script to debug AssetAmount.amount = 0 issues
 * Tests AssetAmount entities that should have values but are 0
 * 
 * Usage: pnpm ts-node test-asset-amount-zero.ts <assetAmountId> [chainId]
 * Example: pnpm ts-node test-asset-amount-zero.ts 0x003d3b28995834e99458051cd2f84fd947c042a6b3dba25320686f1bdc3430a2-0x3523de26602bec599a01da5f0ca91df9b85964e7-LP-387 1
 */

import * as dotenv from "dotenv";
dotenv.config();

import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

// Subgraph GraphQL endpoint
const SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_cm55feuq3euos01xjb3w504ls/subgraphs/spectra-mainnet/1.4.0/gn";

interface GraphQLResponse {
  data?: {
    assetAmount?: {
      id: string;
      amount: string;
      asset: {
        address: string;
        type: string;
      };
      transactionIn?: {
        id: string;
        block: string;
        type: string;
      };
      transactionOut?: {
        id: string;
        block: string;
        type: string;
      };
    };
    transaction?: {
      id: string;
      block: string;
      type: string;
      amountsIn?: Array<{
        amount: string;
        asset: {
          address: string;
          type: string;
        };
      }>;
      amountsOut?: Array<{
        amount: string;
        asset: {
          address: string;
          type: string;
        };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

async function getAssetAmountFromSubgraph(assetAmountId: string): Promise<any> {
  // Remove chainId prefix if present
  const subgraphId = assetAmountId.includes("-") && !assetAmountId.startsWith("0x")
    ? assetAmountId.split("-").slice(1).join("-")
    : assetAmountId;

  const query = `
    query GetAssetAmount($id: ID!) {
      assetAmount(id: $id) {
        id
        amount
        asset {
          address
          type
        }
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { id: subgraphId },
    }),
  });

  const result = (await response.json()) as GraphQLResponse;
  
  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    return null;
  }

  return result.data?.assetAmount || null;
}

async function getTransactionFromSubgraph(transactionId: string): Promise<any> {
  // Remove chainId prefix if present
  const subgraphId = transactionId.includes("-") && !transactionId.startsWith("0x")
    ? transactionId.split("-").slice(1).join("-")
    : transactionId;

  const query = `
    query GetTransaction($id: ID!) {
      transaction(id: $id) {
        id
        block
        type
        amountsIn {
          amount
          asset {
            address
            type
          }
        }
        amountsOut {
          amount
          asset {
            address
            type
          }
        }
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { id: subgraphId },
    }),
  });

  const result = (await response.json()) as GraphQLResponse;
  
  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    return null;
  }

  return result.data?.transaction || null;
}

async function main() {
  const assetAmountId = process.argv[2];
  const chainIdArg = process.argv[3];
  
  if (!assetAmountId) {
    console.error("Usage: pnpm ts-node test-asset-amount-zero.ts <assetAmountId> [chainId]");
    console.error("Example: pnpm ts-node test-asset-amount-zero.ts 0x003d3b28995834e99458051cd2f84fd947c042a6b3dba25320686f1bdc3430a2-0x3523de26602bec599a01da5f0ca91df9b85964e7-LP-387 1");
    process.exit(1);
  }

  let chainId = chainIdArg ? parseInt(chainIdArg) : 1;

  console.log(`\n=== Testing AssetAmount with Zero Amount ===`);
  console.log(`AssetAmount ID: ${assetAmountId}`);
  console.log(`Chain ID: ${chainId}\n`);

  // Get AssetAmount from subgraph
  console.log(`Fetching AssetAmount from subgraph...`);
  const assetAmount = await getAssetAmountFromSubgraph(assetAmountId);
  
  if (!assetAmount) {
    console.error("AssetAmount not found in subgraph");
    process.exit(1);
  }

  console.log(`\n=== Subgraph AssetAmount Data ===`);
  console.log(`ID: ${assetAmount.id}`);
  console.log(`Amount: ${assetAmount.amount}`);
  console.log(`Asset Address: ${assetAmount.asset.address}`);
  console.log(`Asset Type: ${assetAmount.asset.type}`);

  // Extract transaction hash from AssetAmount ID
  // Format: txHash-assetAddress-type-logIndex
  const idParts = assetAmount.id.split("-");
  if (idParts.length >= 4 && idParts[0].startsWith("0x")) {
    const transactionHash = idParts[0];
    console.log(`\n=== Extracted Transaction Hash ===`);
    console.log(`Transaction Hash: ${transactionHash}`);
    console.log(`\nNote: AssetAmount ID format is: txHash-assetAddress-type-logIndex`);
    console.log(`You can query this transaction on Etherscan to see the event parameters.`);
  }

  console.log(`\n=== Analysis ===`);
  console.log(`Subgraph has amount: ${assetAmount.amount}`);
  console.log(`Envio has amount: 0 (from comparison log)`);
  console.log(`\nPossible causes:`);
  console.log(`1. getAssetAmount() not being called for this transaction`);
  console.log(`2. Amount accumulation logic failing`);
  console.log(`3. Transaction processed but amount not set`);
  console.log(`4. Race condition or timing issue`);
  console.log(`\nCheck:`);
  console.log(`- Is the transaction being processed in Envio?`);
  console.log(`- Is getAssetAmount() called with correct parameters?`);
  console.log(`- Is the amount being accumulated correctly?`);
  console.log(`- Are there any errors in the logs for this transaction?`);
}

main().catch(console.error);

