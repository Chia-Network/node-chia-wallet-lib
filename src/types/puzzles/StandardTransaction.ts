import { JacobianPoint } from '@rigidity/bls-signatures';
import { Coin, CoinSpend } from '@rigidity/chia';
import { Program } from '@rigidity/clvm';
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
