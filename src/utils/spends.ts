import {
    AugSchemeMPL,
    JacobianPoint,
    concatBytes,
    fromHex,
    hash256,
    intToBytes,
} from 'chia-bls';
import { CoinSpend, SpendBundle, sanitizeHex } from 'chia-rpc';

export function getSpendBundleId(spendBundle: SpendBundle): Uint8Array {
    return hash256(
        concatBytes(
            intToBytes(spendBundle.coin_spends.length, 4, 'big'),
            ...spendBundle.coin_spends.map((coinSpend) => {
                const puzzleReveal = fromHex(
                    sanitizeHex(coinSpend.puzzle_reveal)
                );
                const solution = fromHex(sanitizeHex(coinSpend.solution));

                return concatBytes(
                    fromHex(sanitizeHex(coinSpend.coin.parent_coin_info)),
                    fromHex(sanitizeHex(coinSpend.coin.puzzle_hash)),
                    intToBytes(coinSpend.coin.amount, 64, 'big'),
                    intToBytes(puzzleReveal.length, 4, 'big'),
                    puzzleReveal,
                    intToBytes(solution.length, 4, 'big'),
                    solution
                );
            }),
            fromHex(sanitizeHex(spendBundle.aggregated_signature))
        )
    );
}

export function aggregateSpendBundles(
    ...spendBundles: SpendBundle[]
): SpendBundle {
    const coinSpends: Array<CoinSpend> = [];
    const signatures: Array<JacobianPoint> = [];

    for (const spendBundle of spendBundles) {
        coinSpends.push(...spendBundle.coin_spends);
        signatures.push(
            JacobianPoint.fromHexG2(
                sanitizeHex(spendBundle.aggregated_signature)
            )
        );
    }

    return {
        coin_spends: coinSpends,
        aggregated_signature: AugSchemeMPL.aggregate(signatures).toHex(),
    };
}
