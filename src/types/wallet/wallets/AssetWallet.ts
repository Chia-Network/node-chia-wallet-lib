import { toHex } from '@rigidity/bls-signatures';
import {
    CoinRecord,
    CoinSpend,
    FullNode,
    sanitizeHex,
    SpendBundle,
    toCoinId,
} from '@rigidity/chia';
import { Program } from '@rigidity/clvm';
import {
    calculateSyntheticPrivateKey,
    calculateSyntheticPublicKey,
} from '../../../utils/keys';
import { puzzles } from '../../../utils/puzzles';
import { signSpendBundle } from '../../../utils/sign';
import { AssetToken } from '../../puzzles/AssetToken';
import { StandardTransaction } from '../../puzzles/StandardTransaction';
import { KeyPair, KeyStore } from '../KeyStore';
import { Wallet, WalletOptions } from '../Wallet';

export class AssetWallet extends Wallet<AssetToken<StandardTransaction>> {
    public readonly assetId: Uint8Array;
    public readonly hiddenPuzzleHash: Uint8Array;
    private tail: Program | null = null;

    constructor(
        node: FullNode,
        keyStore: KeyStore,
        assetId: Uint8Array,
        hiddenPuzzleHash: Uint8Array = puzzles.defaultHidden.hash(),
        walletOptions: Partial<WalletOptions> = {}
    ) {
        super(node, keyStore, walletOptions);
        this.assetId = assetId;
        this.hiddenPuzzleHash = hiddenPuzzleHash;
    }

    public createPuzzle(keyPair: KeyPair): AssetToken<StandardTransaction> {
        return new AssetToken(
            this.assetId,
            new StandardTransaction(
                calculateSyntheticPublicKey(
                    keyPair.publicKey,
                    this.hiddenPuzzleHash
                )
            )
        );
    }

    public async getParentCoinSpend(
        coinRecord: CoinRecord
    ): Promise<CoinSpend> {
        const parentResult = await this.node.getCoinRecordByName(
            coinRecord.coin.parent_coin_info
        );
        if (!parentResult.success) throw new Error(parentResult.error);

        const parentCoinSpendResult = await this.node.getPuzzleAndSolution(
            coinRecord.coin.parent_coin_info,
            parentResult.coin_record.spent_block_index
        );
        if (!parentCoinSpendResult.success)
            throw new Error(parentCoinSpendResult.error);

        return parentCoinSpendResult.coin_solution;
    }

    public async findTail(): Promise<Program | null> {
        if (this.tail) return this.tail;

        let [coinRecord] = this.coinRecords.flat();

        if (!coinRecord) return null;

        while (true) {
            const eveCoinRecord = coinRecord;

            const coinRecordResult = await this.node.getCoinRecordByName(
                coinRecord.coin.parent_coin_info
            );
            if (!coinRecordResult.success)
                throw new Error(coinRecordResult.error);

            coinRecord = coinRecordResult.coin_record;

            const coinSpendResult = await this.node.getPuzzleAndSolution(
                toHex(toCoinId(coinRecord.coin)),
                coinRecord.spent_block_index
            );
            if (!coinSpendResult.success)
                throw new Error(coinSpendResult.error);

            const coinSpend = coinSpendResult.coin_solution;

            const puzzle = Program.deserializeHex(
                sanitizeHex(coinSpend.puzzle_reveal)
            );

            const uncurriedPuzzle = puzzle.uncurry();
            if (!uncurriedPuzzle) continue;

            const [puzzleMod] = uncurriedPuzzle;
            if (puzzleMod.equals(puzzles.cat)) continue;

            if (!eveCoinRecord.spent_block_index) continue;

            const eveCoinSpendResult = await this.node.getPuzzleAndSolution(
                toHex(toCoinId(eveCoinRecord.coin)),
                eveCoinRecord.spent_block_index
            );
            if (!eveCoinSpendResult.success)
                throw new Error(eveCoinSpendResult.error);

            const eveCoinSpend = eveCoinSpendResult.coin_solution;

            const evePuzzle = Program.deserializeHex(
                sanitizeHex(eveCoinSpend.puzzle_reveal)
            );

            const uncurriedEvePuzzle = evePuzzle.uncurry();
            if (
                !uncurriedEvePuzzle ||
                !uncurriedEvePuzzle[0].equals(puzzles.cat)
            )
                throw new Error('Eve is not an asset token.');

            const result = uncurriedEvePuzzle[1][2].run(Program.nil).value;

            if (result.isAtom) throw new Error('Asset spend output is atom.');

            const conditions = result.toList();

            for (const condition of conditions) {
                if (condition.isAtom) continue;

                const args = condition.toList();

                if (args.length < 5) continue;

                if (args[0].isCons || args[0].toBigInt() !== 51n) continue;
                if (args[2].isCons || args[2].toBigInt() !== -113n) continue;

                this.tail = args[3];

                return this.tail;
            }

            break;
        }

        throw new Error('Coin record is not a genesis.');
    }

    public signSpend(
        spendBundle: SpendBundle,
        aggSigMeExtraData: Uint8Array
    ): void {
        signSpendBundle(
            spendBundle,
            aggSigMeExtraData,
            true,
            ...this.keyStore.keys
                .filter((keyPair) => keyPair.privateKey !== null)
                .map((keyPair) =>
                    calculateSyntheticPrivateKey(
                        keyPair.privateKey!,
                        this.hiddenPuzzleHash
                    )
                )
                .concat(
                    this.keyStore.privateKey ? [this.keyStore.privateKey] : []
                )
                .concat(
                    ...this.keyStore.keys
                        .filter((keyPair) => keyPair.privateKey !== null)
                        .map((item) => item.privateKey!)
                )
        );
    }
}
