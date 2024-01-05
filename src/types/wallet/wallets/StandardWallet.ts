import { fromHex, toHex } from 'chia-bls';
import {
    CoinSpend,
    FullNode,
    SpendBundle,
    formatHex,
    sanitizeHex,
} from 'chia-rpc';
import { Program } from 'clvm-lib';
import { signSpendBundle } from '../../../utils/sign';
import { StandardTransaction } from '../../puzzles/StandardTransaction';
import { CoinSelection } from '../CoinSelection';
import { KeyStore } from '../KeyStore';
import { Wallet, WalletOptions } from '../Wallet';

export class StandardWallet extends Wallet<StandardTransaction> {
    constructor(
        node: FullNode,
        keyStore: KeyStore,
        walletOptions: Partial<WalletOptions> = {}
    ) {
        super(node, keyStore, walletOptions);
    }

    public async sendFee(amount: number): Promise<CoinSpend[]> {
        const coinRecords = this.selectCoinRecords(
            amount,
            CoinSelection.Oldest
        );

        const spendAmount = coinRecords.reduce(
            (amount, coinRecord) => amount + coinRecord.coin.amount,
            0
        );

        const change =
            this.puzzleHashes[(await this.findUnusedIndices(1, []))[0]];

        const puzzles = coinRecords.map((coinRecord) =>
            this.createPuzzle(
                this.derivationIndexOf(
                    fromHex(sanitizeHex(coinRecord.coin.puzzle_hash))
                )
            )
        );

        const coinSpends = coinRecords.map((record, i) => {
            const puzzle = puzzles[i];

            const conditions: Array<Program> = [];

            if (i === 0) {
                if (spendAmount > amount) {
                    conditions.push(
                        Program.fromSource(
                            `(51 ${formatHex(toHex(change))} ${
                                spendAmount - amount
                            })`
                        )
                    );
                }
            }

            return puzzle.spend(record.coin, puzzle.getSolution(conditions));
        });

        return coinSpends;
    }

    public async send(
        puzzleHash: Uint8Array,
        amount: number,
        fee: number
    ): Promise<CoinSpend[]> {
        const totalAmount = amount + fee;

        const coinRecords = this.selectCoinRecords(
            totalAmount,
            CoinSelection.Oldest
        );

        const spendAmount = coinRecords.reduce(
            (amount, coinRecord) => amount + coinRecord.coin.amount,
            0
        );

        const change =
            this.puzzleHashes[(await this.findUnusedIndices(1, []))[0]];

        const puzzles = coinRecords.map((coinRecord) =>
            this.createPuzzle(
                this.derivationIndexOf(
                    fromHex(sanitizeHex(coinRecord.coin.puzzle_hash))
                )
            )
        );

        const coinSpends = coinRecords.map((record, i) => {
            const puzzle = puzzles[i];

            const conditions: Array<Program> = [];

            if (i === 0) {
                conditions.push(
                    Program.fromSource(
                        `(51 ${formatHex(toHex(puzzleHash))} ${amount})`
                    )
                );

                if (spendAmount > totalAmount) {
                    conditions.push(
                        Program.fromSource(
                            `(51 ${formatHex(toHex(change))} ${
                                spendAmount - totalAmount
                            })`
                        )
                    );
                }
            }

            return puzzle.spend(record.coin, puzzle.getSolution(conditions));
        });

        return coinSpends;
    }

    public override createPuzzle(index: number): StandardTransaction {
        return new StandardTransaction(
            this.keyStore.keys[index].syntheticPublicKey
        );
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
                .filter((keyPair) => keyPair.syntheticPrivateKey !== null)
                .map((keyPair) => keyPair.syntheticPrivateKey!)
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
