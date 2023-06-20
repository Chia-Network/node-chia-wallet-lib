import { JacobianPoint } from 'chia-bls';
import { Program } from 'clvm-lib';
import { STANDARD_TRANSACTION } from '../utils/puzzles';

export function curryStandardTransaction(
    syntheticPublicKey: JacobianPoint
): Program {
    return STANDARD_TRANSACTION.curry([
        Program.fromJacobianPoint(syntheticPublicKey),
    ]);
}
