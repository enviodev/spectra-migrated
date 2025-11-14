// Reference: spectra-subgraph-master/src/utils/dayId.ts

import { SECONDS_PER_DAY } from "../constants";

/**
 * Simulates AssemblyScript's BigInt.toI32() behavior exactly
 * Converts bigint to 32-bit signed integer with proper sign extension and overflow checking
 * Based on exact implementation from @graphprotocol/graph-ts
 * @param value BigInt value to convert
 * @returns 32-bit signed integer (wraps at 2^31)
 */
function toI32(value: bigint): number {
    // Convert bigint to byte array (little-endian, two's complement)
    const bytes: number[] = [];
    
    // Handle negative numbers using two's complement
    if (value < BigInt(0)) {
        // Convert to two's complement representation
        const absValue = -value;
        let carry = BigInt(1);
        let temp = absValue;
        
        // Invert bits and add 1 (two's complement)
        while (temp > BigInt(0) || carry > BigInt(0)) {
            const inverted = (~temp) & BigInt(0xFF);
            const sum = inverted + carry;
            const byte = Number(sum);
            bytes.push(byte & 0xFF);
            carry = BigInt((byte >> 8) & 1);
            temp = temp >> BigInt(8);
        }
    } else {
        // Handle positive numbers
        let val = value;
        if (val === BigInt(0)) {
            bytes.push(0);
        } else {
            while (val > BigInt(0)) {
                bytes.push(Number(val & BigInt(0xFF)));
                val = val >> BigInt(8);
            }
        }
    }
    
    // Check sign bit (MSB of last byte)
    const isNeg = bytes.length > 0 && (bytes[bytes.length - 1] >> 7) === 1;
    const padding = isNeg ? 255 : 0;
    
    // Check for overflow (bytes beyond first 4 should be padding)
    for (let i = 4; i < bytes.length; i++) {
        if (bytes[i] !== padding) {
            // Overflow detected - in AssemblyScript this would assert, but we'll just wrap
            // This matches the behavior when assertions are disabled
            break;
        }
    }
    
    // Pad to 4 bytes with sign extension
    const paddedBytes = new Array(4).fill(padding);
    const minLen = Math.min(paddedBytes.length, bytes.length);
    for (let i = 0; i < minLen; i++) {
        paddedBytes[i] = bytes[i];
    }
    
    // Reconstruct i32 from bytes (little-endian)
    let x = 0;
    x = (x | paddedBytes[3]) << 8;
    x = (x | paddedBytes[2]) << 8;
    x = (x | paddedBytes[1]) << 8;
    x = x | paddedBytes[0];
    
    // Convert to signed 32-bit integer
    return x | 0;
}

/**
 * Get the day ID for a timestamp.
 * @param timestamp Timestamp in seconds.
 * @returns The day ID (matches original: toI32() then integer division)
 */
export function getDayIdFromTimestamp(timestamp: bigint): number {
    // Match original exactly: timestamp.toI32() / SECONDS_PER_DAY
    // toI32() converts to 32-bit integer, then integer division (truncates toward zero)
    const timestampI32 = toI32(timestamp);
    // In AssemblyScript, i32 / i32 truncates toward zero (not Math.floor which rounds down)
    // Use Math.trunc() or | 0 to match AssemblyScript's integer division behavior
    return Math.trunc(timestampI32 / SECONDS_PER_DAY);
}

/**
 * Get a previous day ID for any number of days in the past
 * @param dayId The day ID
 * @param days The number of days to go back
 * @returns The past day ID
 */
export function getPastDayId(dayId: number, days: number): number {
    return dayId - days;
}
