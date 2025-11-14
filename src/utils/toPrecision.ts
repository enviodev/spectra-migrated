// Reference: spectra-subgraph-master/src/utils/toPrecision.ts

export const CURVE_PRECISION = 10;
export const RAYS_PRECISION = 27;

export const toPrecision = (
    value: bigint,
    fromPrecision: number,
    toPrecision: number
): bigint => {
    const precisionDelta = fromPrecision - toPrecision;
    if (precisionDelta === 0) {
        return value;
    } else if (precisionDelta > 0) {
        // Calculate 10^precisionDelta
        let divisor = BigInt(1);
        for (let i = 0; i < precisionDelta; i++) {
            divisor = divisor * BigInt(10);
        }
        return value / divisor;
    } else {
        // Calculate 10^(-precisionDelta)
        let multiplier = BigInt(1);
        for (let i = 0; i < -precisionDelta; i++) {
            multiplier = multiplier * BigInt(10);
        }
        return value * multiplier;
    }
};
