import {
    AugSchemeMPL,
    concatBytes,
    encodeInt,
    fromHex,
    hash256,
    JacobianPoint,
    PrivateKey,
} from 'chia-bls';
import { CoinSpend, sanitizeHex, SpendBundle } from 'chia-rpc';
import { Program } from 'clvm-lib';

export function signSpendBundle(
    spendBundle: SpendBundle,
    aggSigMeExtraData: Uint8Array,
    partial: boolean,
    ...privateKeys: PrivateKey[]
): void {
    const signatures: Array<JacobianPoint> = [
        JacobianPoint.fromHexG2(sanitizeHex(spendBundle.aggregated_signature)),
    ];

    for (const coinSpend of spendBundle.coin_spends) {
        signatures.push(
            signCoinSpend(coinSpend, aggSigMeExtraData, partial, ...privateKeys)
        );
    }

    spendBundle.aggregated_signature =
        AugSchemeMPL.aggregate(signatures).toHex();
}

export function signCoinSpend(
    coinSpend: CoinSpend,
    aggSigMeExtraData: Uint8Array,
    partial: boolean,
    ...privateKeys: PrivateKey[]
): JacobianPoint {
    const signatures: Array<JacobianPoint> = [];

    const conditions = Program.deserializeHex(
        sanitizeHex(coinSpend.puzzle_reveal)
    )
        .run(Program.deserializeHex(sanitizeHex(coinSpend.solution)))
        .value.toList();

    const pairs: Array<[JacobianPoint, Uint8Array]> = [];

    for (const item of conditions.filter(
        (condition) =>
            condition.first.isAtom && [49, 50].includes(condition.first.toInt())
    )) {
        const condition = item.toList();

        if (condition.length !== 3)
            throw new Error('Invalid condition length.');
        else if (!condition[1].isAtom || condition[1].atom.length !== 48)
            throw new Error('Invalid public key.');
        else if (!condition[2].isAtom || condition[2].atom.length > 1024)
            throw new Error('Invalid message.');

        pairs.push([
            JacobianPoint.fromBytesG1(condition[1].atom),
            concatBytes(
                condition[2].atom,
                ...(condition[0].toInt() === 49
                    ? []
                    : [
                          hash256(
                              concatBytes(
                                  fromHex(
                                      sanitizeHex(
                                          coinSpend.coin.parent_coin_info
                                      )
                                  ),
                                  fromHex(
                                      sanitizeHex(coinSpend.coin.puzzle_hash)
                                  ),
                                  encodeInt(coinSpend.coin.amount)
                              )
                          ),
                          aggSigMeExtraData,
                      ])
            ),
        ]);
    }

    for (const [publicKey, message] of pairs) {
        let privateKey = privateKeys.find((privateKey) =>
            privateKey.getG1().equals(publicKey)
        );

        if (!privateKey) {
            if (partial) continue;

            throw new Error(
                `Could not find private key for ${publicKey.toHex()}.`
            );
        }

        signatures.push(AugSchemeMPL.sign(privateKey, message));
    }

    return signatures.length > 0
        ? AugSchemeMPL.aggregate(signatures)
        : JacobianPoint.infinityG2();
}
