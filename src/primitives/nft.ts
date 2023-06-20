import { Program } from 'clvm-lib';
import {
    NFT_OWNERSHIP_LAYER,
    NFT_OWNERSHIP_LAYER_HASH,
    NFT_STATE_LAYER,
    NFT_STATE_LAYER_HASH,
    NFT_TRANSFER_PROGRAM,
    SINGLETON,
    SINGLETON_HASH,
    SINGLETON_LAUNCHER_HASH,
} from '../utils/puzzles';
import { createSingletonStruct } from './singleton';

export function createNftSingleton(
    launcherId: Uint8Array,
    metadata: Program,
    metadataUpdaterPuzzleHash: Uint8Array,
    innerPuzzle: Program
): Program {
    const singletonStruct = createSingletonStruct(
        SINGLETON_HASH,
        launcherId,
        SINGLETON_LAUNCHER_HASH
    );

    const singletonInnerPuzzle = createNftStateLayer(
        metadata,
        metadataUpdaterPuzzleHash,
        innerPuzzle
    );

    return SINGLETON.curry([singletonStruct, singletonInnerPuzzle]);
}

export function createNftStateLayer(
    metadata: Program,
    metadataUpdaterPuzzleHash: Uint8Array,
    innerPuzzle: Program
): Program {
    return NFT_STATE_LAYER.curry([
        Program.fromBytes(NFT_STATE_LAYER_HASH),
        metadata,
        Program.fromBytes(metadataUpdaterPuzzleHash),
        innerPuzzle,
    ]);
}

export function createNftOwnershipLayer(
    launcherId: Uint8Array,
    did: Uint8Array | null,
    innerPuzzle: Program,
    royaltyPercent: number = 0,
    royaltyPuzzleHash: Uint8Array = innerPuzzle.hash()
): Program {
    const singletonStruct = createSingletonStruct(
        SINGLETON_HASH,
        launcherId,
        SINGLETON_LAUNCHER_HASH
    );

    const transferProgram = NFT_TRANSFER_PROGRAM.curry([
        singletonStruct,
        Program.fromBytes(royaltyPuzzleHash),
        Program.fromInt(royaltyPercent),
    ]);

    return NFT_OWNERSHIP_LAYER.curry([
        Program.fromBytes(NFT_OWNERSHIP_LAYER_HASH),
        did ? Program.fromBytes(did) : Program.nil,
        transferProgram,
        innerPuzzle,
    ]);
}
