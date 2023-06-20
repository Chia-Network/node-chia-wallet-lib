import {
    AugSchemeMPL,
    bigIntToBytes,
    bytesToBigInt,
    concatBytes,
    decodeBigInt,
    hash256,
    JacobianPoint,
    mod,
    PrivateKey,
} from 'chia-bls';

const groupOrder =
    0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

export function calculateSyntheticPublicKey(
    publicKey: JacobianPoint,
    hiddenPuzzleHash: Uint8Array
): JacobianPoint {
    return publicKey.add(
        PrivateKey.fromBytes(
            hash256(concatBytes(publicKey.toBytes(), hiddenPuzzleHash))
        ).getG1()
    );
}

export function calculateSyntheticPrivateKey(
    privateKey: PrivateKey,
    hiddenPuzzleHash: Uint8Array
): PrivateKey {
    const privateExponent = bytesToBigInt(privateKey.toBytes(), 'big');
    const publicKey = privateKey.getG1();
    const syntheticOffset = calculateSyntheticOffset(
        publicKey,
        hiddenPuzzleHash
    );
    const syntheticPrivateExponent = mod(
        privateExponent + syntheticOffset,
        groupOrder
    );
    const blob = bigIntToBytes(syntheticPrivateExponent, 32, 'big');
    return PrivateKey.fromBytes(blob);
}

export function calculateSyntheticOffset(
    publicKey: JacobianPoint,
    hiddenPuzzleHash: Uint8Array
): bigint {
    const blob = hash256(concatBytes(publicKey.toBytes(), hiddenPuzzleHash));
    return mod(decodeBigInt(blob), groupOrder);
}

export function derivePrivateKeyPath(
    privateKey: PrivateKey,
    path: number[],
    hardened: boolean
): PrivateKey {
    for (const index of path)
        privateKey = (
            hardened
                ? AugSchemeMPL.deriveChildSk
                : AugSchemeMPL.deriveChildSkUnhardened
        )(privateKey, index);
    return privateKey;
}

export function derivePublicKeyPath(
    publicKey: JacobianPoint,
    path: number[]
): JacobianPoint {
    for (const index of path)
        publicKey = AugSchemeMPL.deriveChildPkUnhardened(publicKey, index);
    return publicKey;
}

export function derivePrivateKey(
    masterPrivateKey: PrivateKey,
    index: number,
    hardened: boolean
): PrivateKey {
    return derivePrivateKeyPath(
        masterPrivateKey,
        [12381, 8444, 2, index],
        hardened
    );
}

export function derivePublicKey(
    masterPublicKey: JacobianPoint,
    index: number
): JacobianPoint {
    return derivePublicKeyPath(masterPublicKey, [12381, 8444, 2, index]);
}
