import { AugSchemeMPL, JacobianPoint, PrivateKey } from 'chia-bls';
import {
    calculateSyntheticPrivateKey,
    calculateSyntheticPublicKey,
    derivePrivateKeyIntermediate,
    derivePublicKeyIntermediate,
} from '../../utils/keys';
import { puzzles } from '../../utils/puzzles';

export interface KeyPair {
    readonly publicKey: JacobianPoint;
    readonly privateKey: PrivateKey | null;
    readonly syntheticPublicKey: JacobianPoint;
    readonly syntheticPrivateKey: PrivateKey | null;
}

export class KeyStore {
    public readonly privateKey: PrivateKey | null;
    public readonly publicKey: JacobianPoint;

    private readonly intermediatePrivateKey: PrivateKey | null;
    private readonly intermediatePublicKey: JacobianPoint;

    public readonly hardened: boolean;
    public readonly hiddenPuzzleHash: Uint8Array;

    public readonly keys: Array<KeyPair> = [];

    constructor(
        key: PrivateKey | JacobianPoint,
        hardened: boolean = false,
        hiddenPuzzleHash: Uint8Array = puzzles.defaultHiddenHash
    ) {
        if (key instanceof PrivateKey) {
            this.privateKey = key;
            this.publicKey = key.getG1();
            this.intermediatePrivateKey = derivePrivateKeyIntermediate(
                key,
                hardened
            );
            this.intermediatePublicKey = this.intermediatePrivateKey.getG1();
        } else if (key instanceof JacobianPoint) {
            this.privateKey = null;
            this.publicKey = key;
            this.intermediatePrivateKey = null;
            this.intermediatePublicKey = derivePublicKeyIntermediate(key);
        } else {
            throw new TypeError('Key must be a PrivateKey or JacobianPoint.');
        }

        this.hardened = hardened;
        this.hiddenPuzzleHash = hiddenPuzzleHash;
    }

    public generate(amount: number): void {
        const keys = this.keys;

        const targetLength = keys.length + amount;

        for (let index = keys.length; index < targetLength; index++) {
            keys.push(this.generateKeyPair(index));
        }
    }

    public generateUntil(amount: number): void {
        const generateAmount = amount - this.keys.length;

        if (generateAmount > 0) this.generate(generateAmount);
    }

    private generateKeyPair(index: number): KeyPair {
        let privateKey: PrivateKey | null;
        let publicKey: JacobianPoint;

        if (this.hardened || this.intermediatePrivateKey) {
            let intermediate = this.intermediatePrivateKey;
            if (!intermediate)
                throw new Error('Cannot generate hardened public key.');

            privateKey = (
                this.hardened
                    ? AugSchemeMPL.deriveChildSk
                    : AugSchemeMPL.deriveChildSkUnhardened
            )(intermediate, index);
            publicKey = privateKey.getG1();
        } else {
            privateKey = null;
            publicKey = AugSchemeMPL.deriveChildPkUnhardened(
                this.intermediatePublicKey,
                index
            );
        }

        const syntheticPrivateKey = privateKey
            ? calculateSyntheticPrivateKey(privateKey, this.hiddenPuzzleHash)
            : null;
        const syntheticPublicKey = syntheticPrivateKey
            ? syntheticPrivateKey.getG1()
            : calculateSyntheticPublicKey(publicKey, this.hiddenPuzzleHash);

        return {
            publicKey,
            privateKey,
            syntheticPublicKey,
            syntheticPrivateKey,
        };
    }
}
