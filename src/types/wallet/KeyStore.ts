import { JacobianPoint, PrivateKey } from 'chia-bls';
import { derivePrivateKey, derivePublicKey } from '../../utils/keys';

export interface KeyPair {
    readonly publicKey: JacobianPoint;
    readonly privateKey: PrivateKey | null;
}

export class KeyStore {
    public readonly privateKey: PrivateKey | null;
    public readonly publicKey: JacobianPoint;

    public readonly hardened: boolean;

    public readonly keys: Array<KeyPair> = [];

    constructor(key: PrivateKey | JacobianPoint, hardened: boolean = false) {
        [this.privateKey, this.publicKey] =
            key instanceof PrivateKey ? [key, key.getG1()] : [null, key];
        this.hardened = hardened;
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

        if (this.hardened || this.privateKey) {
            let rootPrivateKey = this.privateKey;

            if (!rootPrivateKey)
                throw new Error(
                    'Cannot generate private key without root private key.'
                );

            privateKey = derivePrivateKey(rootPrivateKey, index, this.hardened);
            publicKey = privateKey.getG1();
        } else {
            privateKey = null;
            publicKey = derivePublicKey(this.publicKey, index);
        }

        return { publicKey, privateKey };
    }
}
