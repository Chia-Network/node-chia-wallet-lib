import { Program } from 'clvm-lib';
import fs from 'fs';
import path from 'path';

const basePath = path.join(__dirname, '..', '..', 'puzzles');

const puzzle = (name: string) =>
    Program.deserializeHex(
        fs.readFileSync(path.join(basePath, `${name}.clsp.hex`), 'utf-8')
    );

export const STANDARD_TRANSACTION = puzzle('standard-transaction');
export const HIDDEN_PUZZLE = puzzle('hidden-puzzle');
export const HIDDEN_PUZZLE_HASH = HIDDEN_PUZZLE.hash();

export const SINGLETON = puzzle('singleton');
export const SINGLETON_LAUNCHER = puzzle('singleton-launcher');
export const SINGLETON_HASH = SINGLETON.hash();
export const SINGLETON_LAUNCHER_HASH = SINGLETON_LAUNCHER.hash();

export const CAT = puzzle('cat');
export const DID = puzzle('did');

export const NFT_STATE_LAYER = puzzle('nft-state-layer');
export const NFT_OWNERSHIP_LAYER = puzzle('nft-ownership-layer');
export const NFT_STATE_LAYER_HASH = NFT_STATE_LAYER.hash();
export const NFT_OWNERSHIP_LAYER_HASH = NFT_OWNERSHIP_LAYER.hash();

export const NFT_TRANSFER_ROYALTIES = puzzle('nft-transfer-royalties');
export const NFT_TRANSFER_PROGRAM = puzzle('nft-transfer-program');
