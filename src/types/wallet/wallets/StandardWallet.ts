import { FullNode, SpendBundle } from '@rigidity/chia';
import {
    calculateSyntheticPrivateKey,
    calculateSyntheticPublicKey,
} from '../../../utils/keys';
import { puzzles } from '../../../utils/puzzles';
import { signSpendBundle } from '../../../utils/sign';
import { StandardTransaction } from '../../puzzles/StandardTransaction';
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
