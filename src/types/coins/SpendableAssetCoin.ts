import { Coin, CoinSpend } from 'chia-rpc';
import { Program } from 'clvm-lib';
import { AssetToken } from '../puzzles/AssetToken';
import { AssetCoin } from './AssetCoin';

export class SpendableAssetCoin extends AssetCoin {
    public readonly puzzle: Program;
    public readonly innerPuzzle: Program;
    public readonly innerSolution: Program;
    public readonly extraDelta: number;

    constructor(
        parentCoinSpend: CoinSpend,
        coin: Coin,
        innerPuzzle: Program,
        innerSolution: Program,
        extraDelta: number = 0,
        assetId?: Uint8Array
    ) {
        super(parentCoinSpend, coin, assetId);

        this.innerPuzzle = innerPuzzle;
        this.innerSolution = innerSolution;
        this.extraDelta = extraDelta;

        this.puzzle = new AssetToken(this.assetId, innerPuzzle);
    }

    public static calculateSubtotals(deltas: number[]): number[] {
        let subtotal = 0;

        const subtotals = deltas.map((delta) => {
            const current = subtotal;

            subtotal += delta;

            return current;
        });

        const offset = Math.min.apply(null, subtotals);

        return subtotals.map((value) => value - offset);
    }

    public static calculateDeltas(
        spendableAssetCoins: Array<SpendableAssetCoin>
    ): number[] {
        return spendableAssetCoins.map((spendableAssetCoin) => {
            const conditions = spendableAssetCoin.innerPuzzle
                .run(spendableAssetCoin.innerSolution)
                .value.toList();

            let total = -spendableAssetCoin.extraDelta;

            for (const condition of conditions) {
                if (condition.isAtom) continue;

                const items = condition.toList();
                if (items.length < 3) continue;

                if (
                    items[0].isCons ||
                    items[1].isCons ||
                    items[2].isCons ||
                    items[0].toBigInt() !== 51n ||
                    items[2].toBigInt() === -113n
                )
                    continue;

                total += items[2].toInt();
            }

            return total;
        });
    }
}
