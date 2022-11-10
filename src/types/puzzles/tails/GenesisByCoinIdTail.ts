import { Program } from '@rigidity/clvm';
import { puzzles } from '../../../utils/puzzles';

export class GenesisByCoinIdTail extends Program {
    constructor(coinId: Uint8Array) {
        super(
            puzzles.tails.genesisByCoinId.curry([Program.fromBytes(coinId)])
                .value
        );
    }
}
