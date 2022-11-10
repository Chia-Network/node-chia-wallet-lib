import { JacobianPoint } from '@rigidity/bls-signatures';
import { Program } from '@rigidity/clvm';
import { puzzles } from '../../../utils/puzzles';

export class DelegatedTail extends Program {
    constructor(publicKey: JacobianPoint) {
        super(
            puzzles.tails.delegated.curry([
                Program.fromJacobianPoint(publicKey),
            ]).value
        );
    }
}
