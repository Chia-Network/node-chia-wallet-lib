import { JacobianPoint } from 'chia-bls';
import { Program } from 'clvm-lib';
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
