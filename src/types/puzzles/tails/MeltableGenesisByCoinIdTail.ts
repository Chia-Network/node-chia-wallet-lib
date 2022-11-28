import { Program } from 'clvm-lib';
import { puzzles } from '../../../utils/puzzles';

export class MeltableGenesisByCoinIdTail extends Program {
    constructor(coinId: Uint8Array) {
        super(
            puzzles.tails.meltableGenesisByCoinId.curry([
                Program.fromBytes(coinId),
            ]).value
        );
    }
}
