import { Buffer } from 'buffer';
import { assert, expect } from 'chai';
import { describe } from 'mocha';

import { PrivateKey } from 'chia-bls';
import { derivePublicKeyPath, derivePublicKey, calculateSyntheticPublicKey } from '../src/utils/keys';

describe('Key derivation', () => {
    // attempting to replicate the rust chia_rs library test for an index value of 0
    // https://github.com/Chia-Network/chia_rs/blob/739c081ca3720f43be281d85ad9c6e1bc0198f70/chia-wallet/src/derive_synthetic.rs#L56

    const DEFAULT_HIDDEN_PUZZLE_HASH: Uint8Array = Buffer.from("711d6c4e32c92e53179b199484cf8c897542bc57f2b22582799f9d657eec4699", 'hex');
    const sk = PrivateKey.fromHex("6bb19282e27bc6e7e397fb19efc2627a412410fdfd13bf14f4ce5bfdce084c71");
    const pk = sk.getG1();
    const intermediate = derivePublicKeyPath(pk, [12381, 8444, 2]);
    const key = derivePublicKey(intermediate, 0);
    const syntheticKey = calculateSyntheticPublicKey(key, DEFAULT_HIDDEN_PUZZLE_HASH);
    const syntheticKeyHex = syntheticKey.toHex()

    it('Index 0', () =>
        assert(
            // this value comes from the rust library test as the expected result
            "b0c8cf08fdbe7fdb7bb1795740153b944c32364b100c372a05833554cb97794563b096cb5f57bfa09f38d7aebb48704e" ==
            syntheticKeyHex
        ));

});
