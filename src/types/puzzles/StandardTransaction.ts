import { JacobianPoint } from 'chia-bls';
import { Coin, CoinSpend } from 'chia-rpc';
import { Program } from 'clvm-lib';
import { puzzles } from '../../utils/puzzles';

export class StandardTransaction extends Program {
    public readonly syntheticPublicKey: JacobianPoint;

    constructor(syntheticPublicKey: JacobianPoint) {
        super(
            puzzles.payToDelegatedOrHidden.curry([
                Program.fromJacobianPoint(syntheticPublicKey),
            ]).value
        );

        this.syntheticPublicKey = syntheticPublicKey;
    }

    public getSolution(conditions: Program[]): Program {
        const delegatedPuzzle = puzzles.payToConditions.run(
            Program.fromList([Program.fromList(conditions)])
        ).value;

        return Program.fromList([Program.nil, delegatedPuzzle, Program.nil]);
    }

    public spend(coin: Coin, solution: Program): CoinSpend {
        return {
            coin,
            puzzle_reveal: this.serializeHex(),
            solution: solution.serializeHex(),
        };
    }
}
