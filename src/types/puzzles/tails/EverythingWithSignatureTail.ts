import { JacobianPoint } from '@rigidity/bls-signatures';
import { Program } from '@rigidity/clvm';
import { puzzles } from '../../../utils/puzzles';

export class EverythingWithSignatureTail extends Program {
    constructor(publicKey: JacobianPoint) {
        super(
            puzzles.tails.everythingWithSignature.curry([
                Program.fromJacobianPoint(publicKey),
            ]).value
        );
    }
}
