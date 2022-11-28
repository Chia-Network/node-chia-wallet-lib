import { toHex } from 'chia-bls';
import { CoinSpend, formatHex, FullNode, SpendBundle } from 'chia-rpc';
import { Program } from 'clvm-lib';
import {
    calculateSyntheticPrivateKey,
    calculateSyntheticPublicKey,
} from '../../../utils/keys';
import { puzzles } from '../../../utils/puzzles';
import { signSpendBundle } from '../../../utils/sign';
import { StandardTransaction } from '../../puzzles/StandardTransaction';
import { CoinSelection } from '../CoinSelection';
import { KeyPair, KeyStore } from '../KeyStore';
import { Wallet, WalletOptions } from '../Wallet';

export class StandardWallet extends Wallet<StandardTransaction> {
    public readonly hiddenPuzzleHash: Uint8Array;

    constructor(
        node: FullNode,
        keyStore: KeyStore,
        hiddenPuzzleHash: Uint8Array = puzzles.defaultHidden.hash(),
        walletOptions: Partial<WalletOptions> = {}
    ) {
        super(node, keyStore, walletOptions);
        this.hiddenPuzzleHash = hiddenPuzzleHash;
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
            this.puzzleCache[(await this.findUnusedIndices(1, []))[0]];

        const puzzles = coinRecords.map(
            (coinRecord) => this.puzzleCache[this.coinRecordIndex(coinRecord)]
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
                            `(51 ${formatHex(change.hashHex())} ${
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

    public createPuzzle(keyPair: KeyPair): StandardTransaction {
        return new StandardTransaction(
            calculateSyntheticPublicKey(
                keyPair.publicKey,
                this.hiddenPuzzleHash
            )
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
