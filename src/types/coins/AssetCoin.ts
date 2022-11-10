import { Coin, CoinSpend, sanitizeHex } from '@rigidity/chia';
import { Program } from '@rigidity/clvm';
import { puzzles } from '../../utils/puzzles';

export class AssetCoin {
    public readonly parentCoinSpend: CoinSpend;
    public readonly assetId: Uint8Array;
    public readonly lineageProof: Program;
    public readonly coin: Coin;

    constructor(parentCoinSpend: CoinSpend, coin: Coin, assetId?: Uint8Array) {
        this.parentCoinSpend = parentCoinSpend;
        this.coin = coin;

        if (assetId) {
            this.assetId = assetId;
            this.lineageProof = Program.nil;
        } else {
            const parentPuzzleReveal = Program.deserializeHex(
                sanitizeHex(parentCoinSpend.puzzle_reveal)
            );

            const parentPuzzleUncurried = parentPuzzleReveal.uncurry();
            if (!parentPuzzleUncurried)
                throw new Error('Could not uncurry parent puzzle reveal.');

            const [parentPuzzle, parentArguments] = parentPuzzleUncurried;

            if (!parentPuzzle.equals(puzzles.cat))
                throw new Error('Parent puzzle is not asset token.');

            if (parentArguments.length <= 2)
                throw new Error('Invalid parent puzzle reveal.');

            this.assetId = parentArguments[1].atom;
            this.lineageProof = Program.fromList([
                Program.fromHex(
                    sanitizeHex(parentCoinSpend.coin.parent_coin_info)
                ),
                Program.fromBytes(parentArguments[2].hash()),
                Program.fromInt(parentCoinSpend.coin.amount),
            ]);
        }
    }
}
