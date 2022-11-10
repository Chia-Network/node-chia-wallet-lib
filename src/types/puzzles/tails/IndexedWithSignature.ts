import { JacobianPoint } from '@rigidity/bls-signatures';
import { Program } from '@rigidity/clvm';
import { puzzles } from '../../../utils/puzzles';

export class IndexedWithSignature extends Program {
    constructor(publicKey: JacobianPoint, index: number) {
        super(
            puzzles.tails.indexedWithSignature.curry([
                Program.fromJacobianPoint(publicKey),
                Program.fromInt(index),
            ]).value
        );
    }
}
