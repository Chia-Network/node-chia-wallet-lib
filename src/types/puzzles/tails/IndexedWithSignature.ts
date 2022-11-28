import { JacobianPoint } from 'chia-bls';
import { Program } from 'clvm-lib';
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
