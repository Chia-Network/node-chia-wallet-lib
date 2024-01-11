import { Program } from 'clvm-lib';
import fs from 'fs';
import path from 'path';

const standardTransaction = puzzle('pay_to_delegated_or_hidden');
const defaultHidden = puzzle('default_hidden');

export const puzzles = {
    cat: puzzle('cat'),
    syntheticPublicKey: puzzle('synthetic_public_key'),
    defaultHidden,
    defaultHiddenHash: defaultHidden.hash(),
    payToConditions: puzzle('pay_to_conditions'),
    standardTransaction,
    standardTransactionHash: standardTransaction.hash(),
    tails: {
        delegated: puzzle('tails', 'delegated'),
        everythingWithSignature: puzzle('tails', 'everything_with_signature'),
        indexedWithSignature: puzzle('tails', 'indexed_with_signature'),
        genesisByCoinId: puzzle('tails', 'genesis_by_coin_id'),
        meltableGenesisByCoinId: puzzle('tails', 'meltable_genesis_by_coin_id'),
    },
};

function puzzle(...name: string[]): Program {
    return Program.deserializeHex(
        fs
            .readFileSync(
                path.join(
                    __dirname,
                    '..',
                    '..',
                    'puzzles',
                    ...name.slice(0, -1),
                    name.at(-1) + '.clvm.hex'
                ),
                'utf-8'
            )
            .trim()
    );
}
