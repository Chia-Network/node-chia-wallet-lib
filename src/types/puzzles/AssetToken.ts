import { bytesEqual, modNumber, toHex } from '@rigidity/bls-signatures';
import {
    Coin,
    CoinSpend,
    formatHex,
    sanitizeHex,
    toCoinId,
} from '@rigidity/chia';
import { Program } from '@rigidity/clvm';
import { puzzles } from '../../utils/puzzles';
import { SpendableAssetCoin } from '../coins/SpendableAssetCoin';

export class AssetToken<T extends Program> extends Program {
    public readonly assetId: Uint8Array;
    public readonly innerPuzzle: T;

    constructor(assetId: Uint8Array, innerPuzzle: T) {
        super(
            puzzles.cat.curry([
                Program.fromBytes(puzzles.cat.hash()),
                Program.fromBytes(assetId),
                innerPuzzle,
            ]).value
        );

        this.assetId = assetId;
        this.innerPuzzle = innerPuzzle;
    }

    public static calculateIssuePayment(
        tail: Program,
        solution: Program,
        innerPuzzleHash: Uint8Array,
        amount: number
    ): Program {
        return Program.cons(
            Program.fromInt(1),
            Program.fromList([
                Program.fromList([
                    Program.fromInt(51),
                    Program.fromInt(0),
                    Program.fromInt(-113),
                    tail,
                    solution,
                ]),
                Program.fromList([
                    Program.fromInt(51),
                    Program.fromBytes(innerPuzzleHash),
                    Program.fromInt(amount),
                    Program.fromList([Program.fromBytes(innerPuzzleHash)]),
                ]),
            ])
        );
    }

    public static calculatePuzzle(
        tail: Program,
        solution: Program,
        innerPuzzleHash: Uint8Array,
        amount: number
    ): AssetToken<Program> {
        return puzzles.cat.curry([
            Program.fromBytes(puzzles.cat.hash()),
            Program.fromBytes(tail.hash()),
            this.calculateIssuePayment(tail, solution, innerPuzzleHash, amount),
        ]) as AssetToken<Program>;
    }

    public static issue(
        originCoinSpend: CoinSpend,
        tail: Program,
        solution: Program,
        innerPuzzleHash: Uint8Array,
        amount: number
    ): CoinSpend {
        const payToPuzzle = AssetToken.calculateIssuePayment(
            tail,
            solution,
            innerPuzzleHash,
            amount
        );

        const catPuzzle = AssetToken.calculatePuzzle(
            tail,
            solution,
            innerPuzzleHash,
            amount
        );

        const eveCoin: Coin = {
            parent_coin_info: formatHex(toHex(toCoinId(originCoinSpend.coin))),
            puzzle_hash: formatHex(catPuzzle.hashHex()),
            amount,
        };

        const spendableEve = new SpendableAssetCoin(
            originCoinSpend,
            eveCoin,
            payToPuzzle,
            Program.nil,
            undefined,
            tail.hash()
        );

        return AssetToken.spend([spendableEve])[0];
    }

    public static spend(
        spendableAssetCoins: SpendableAssetCoin[]
    ): Array<CoinSpend> {
        if (!spendableAssetCoins.length)
            throw new Error('Missing spendable asset coin.');

        const assetId = spendableAssetCoins[0].assetId;

        for (const item of spendableAssetCoins.slice(1)) {
            if (!bytesEqual(item.assetId, assetId))
                throw new Error('Mixed asset ids in spend.');
        }

        const deltas = SpendableAssetCoin.calculateDeltas(spendableAssetCoins);
        const subtotals = SpendableAssetCoin.calculateSubtotals(deltas);

        return spendableAssetCoins.map((spendableAssetCoin, i) => {
            const previous = modNumber(i - 1, spendableAssetCoins.length);
            const next = modNumber(i + 1, spendableAssetCoins.length);

            const previousCoin = spendableAssetCoins[previous];
            const nextCoin = spendableAssetCoins[next];

            const solution = Program.fromList([
                spendableAssetCoin.innerSolution,
                spendableAssetCoin.lineageProof,
                Program.fromBytes(toCoinId(previousCoin.coin)),
                Program.fromList([
                    Program.fromHex(
                        sanitizeHex(spendableAssetCoin.coin.parent_coin_info)
                    ),
                    Program.fromHex(
                        sanitizeHex(spendableAssetCoin.coin.puzzle_hash)
                    ),
                    Program.fromInt(spendableAssetCoin.coin.amount),
                ]),
                Program.fromList([
                    Program.fromHex(
                        sanitizeHex(nextCoin.coin.parent_coin_info)
                    ),
                    Program.fromBytes(nextCoin.innerPuzzle.hash()),
                    Program.fromInt(nextCoin.coin.amount),
                ]),
                Program.fromInt(subtotals[i]),
                Program.fromInt(spendableAssetCoin.extraDelta),
            ]);

            return {
                coin: spendableAssetCoin.coin,
                puzzle_reveal: spendableAssetCoin.puzzle.serializeHex(),
                solution: solution.serializeHex(),
            };
        });
    }
}
