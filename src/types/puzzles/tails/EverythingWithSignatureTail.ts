import { JacobianPoint } from 'chia-bls';
import { Program } from 'clvm-lib';
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
