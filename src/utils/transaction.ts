import { concatBytes, fromHex, hash256, intToBytes } from 'chia-bls';
import { SpendBundle, sanitizeHex } from 'chia-rpc';

export function getTransactionId(spendBundle: SpendBundle): Uint8Array {
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
