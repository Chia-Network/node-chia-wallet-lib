import { Program } from 'clvm-lib';

export function createSingletonStruct(
    singletonModHash: Uint8Array,
    launcherId: Uint8Array,
    launcherPuzzleHash: Uint8Array
): Program {
    return Program.cons(
        Program.fromBytes(singletonModHash),
        Program.cons(
            Program.fromBytes(launcherId),
            Program.fromBytes(launcherPuzzleHash)
        )
    );
}
