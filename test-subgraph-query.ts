/**
 * Test script to query the subgraph GraphQL endpoint and compare Asset entity values
 * Usage: tsx test-subgraph-query.ts
 */

const SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_cm55feuq3euos01xjb3w504ls/subgraphs/spectra-mainnet/1.4.0/gn";

// Test addresses (without chainId prefix for subgraph)
const TEST_ADDRESSES = [
  "0x0022228a2cc5e7ef0274a7baa600d44da5ab5776",
  "0x004626a008b1acdc4c74ab51644093b155e59a23",
];

interface AssetQueryResult {
  data: {
    asset: {
      id: string;
      chainId: number;
      address: string;
      createdAtTimestamp: string;
      name: string;
      symbol: string;
      decimals: number;
      type: string;
      convertToAssetsUnit: string | null;
      lastIBTRate: string | null;
      lastUpdateTimestamp: string | null;
      underlying: {
        id: string;
        address: string;
        decimals: number;
      } | null;
    } | null;
  };
}

async function querySubgraphAsset(address: string): Promise<void> {
  console.log(`\n=== Querying Subgraph for Asset: ${address} ===\n`);

  const query = `
    query GetAsset($id: ID!) {
      asset(id: $id) {
        id
        chainId
        address
        createdAtTimestamp
        name
        symbol
        decimals
        type
        convertToAssetsUnit
        lastIBTRate
        lastUpdateTimestamp
        underlying {
          id
          address
          decimals
        }
      }
    }
  `;

  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          id: address, // Subgraph uses address as ID (no chainId prefix)
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: AssetQueryResult = await response.json();

    if (result.data.errors) {
      console.error("GraphQL errors:", result.data.errors);
      return;
    }

    const asset = result.data.asset;

    if (!asset) {
      console.log(`❌ Asset not found in subgraph: ${address}`);
      return;
    }

    console.log("✅ Asset found in subgraph:");
    console.log(`   ID: ${asset.id}`);
    console.log(`   Chain ID: ${asset.chainId}`);
    console.log(`   Address: ${asset.address}`);
    console.log(`   Type: ${asset.type}`);
    console.log(`   Name: ${asset.name}`);
    console.log(`   Symbol: ${asset.symbol}`);
    console.log(`   Decimals: ${asset.decimals}`);
    console.log(`   Created At: ${asset.createdAtTimestamp} (${new Date(Number(asset.createdAtTimestamp) * 1000).toISOString()})`);
    console.log(`\n   IBT Rate Fields:`);
    console.log(`   - convertToAssetsUnit: ${asset.convertToAssetsUnit || "null"}`);
    console.log(`   - lastIBTRate: ${asset.lastIBTRate || "null"}`);
    console.log(`   - lastUpdateTimestamp: ${asset.lastUpdateTimestamp || "null"} ${asset.lastUpdateTimestamp ? `(${new Date(Number(asset.lastUpdateTimestamp) * 1000).toISOString()})` : ""}`);
    
    if (asset.underlying) {
      console.log(`\n   Underlying Asset:`);
      console.log(`   - ID: ${asset.underlying.id}`);
      console.log(`   - Address: ${asset.underlying.address}`);
      console.log(`   - Decimals: ${asset.underlying.decimals}`);
    } else {
      console.log(`\n   Underlying Asset: null`);
    }

    // Calculate lastIBTRate from convertToAssetsUnit if both exist
    if (asset.convertToAssetsUnit && asset.underlying) {
      const convertToAssets = BigInt(asset.convertToAssetsUnit);
      const underlyingUnit = BigInt(10) ** BigInt(asset.underlying.decimals);
      const calculatedRate = Number(convertToAssets) / Number(underlyingUnit);
      console.log(`\n   Calculated lastIBTRate (convertToAssetsUnit / 10^${asset.underlying.decimals}): ${calculatedRate}`);
      if (asset.lastIBTRate) {
        console.log(`   Subgraph lastIBTRate: ${asset.lastIBTRate}`);
        console.log(`   Match: ${Math.abs(calculatedRate - parseFloat(asset.lastIBTRate)) < 0.0000001 ? "✅" : "❌"}`);
      }
    }

  } catch (error) {
    console.error(`❌ Error querying subgraph for ${address}:`, error);
  }
}

async function main() {
  console.log("Subgraph Query Test Script");
  console.log("==========================");
  console.log(`Subgraph URL: ${SUBGRAPH_URL}\n`);

  for (const address of TEST_ADDRESSES) {
    await querySubgraphAsset(address);
  }

  console.log("\n=== Comparison with Envio Logs ===");
  console.log("\nFrom the logs, we saw:");
  console.log("Address: 0x0022228a2cc5E7eF0274A7Baa600d44da5aB5776");
  console.log("Block: 19919019");
  console.log("Timestamp: 1716303431");
  console.log("convertToAssetsUnit: 1161731930541538304");
  console.log("lastIBTRate: 1.161731930541538304");
  console.log("lastUpdateTimestamp: 1716303431");
  console.log("Underlying Address: 0x0000206329b97DB379d5E1Bf586BbDB969C63274");
  console.log("Underlying Decimals: 18");
}

main()
  .then(() => {
    console.log("\n✅ Query completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

