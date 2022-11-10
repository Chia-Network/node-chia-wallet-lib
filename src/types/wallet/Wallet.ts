import { bytesEqual, JacobianPoint, toHex } from '@rigidity/bls-signatures';
import {
    Coin,
    CoinRecord,
    formatHex,
    FullNode,
    sanitizeHex,
    SpendBundle,
    toCoinId,
} from '@rigidity/chia';
import { Program } from '@rigidity/clvm';
import { CoinSelection } from './CoinSelection';
import { KeyPair, KeyStore } from './KeyStore';

export interface WalletOptions {
    minAddressCount: number;
    maxAddressCount: number;
    unusedAddressCount: number;
    instantCoinRecords: boolean;
}

const defaultWalletOptions: WalletOptions = {
    minAddressCount: 50,
    maxAddressCount: Infinity,
    unusedAddressCount: 10,
    instantCoinRecords: true,
};

export abstract class Wallet<T extends Program> {
    public readonly node: FullNode;
    public readonly keyStore: KeyStore;
    public readonly options: WalletOptions;

    public readonly coinRecords: Array<CoinRecord[]> = [];
    public readonly artificialCoinRecords: Array<CoinRecord> = [];
    public readonly puzzleCache: Array<T> = [];

    constructor(
        node: FullNode,
        keyStore: KeyStore,
        walletOptions: Partial<WalletOptions> = {}
    ) {
        this.node = node;
        this.keyStore = keyStore;
        this.options = { ...defaultWalletOptions, ...walletOptions };
    }

    public abstract createPuzzle(keyPair: KeyPair): T;

    public coinRecordIndex(coinRecord: CoinRecord): number {
        return this.puzzleCache.findIndex(
            (puzzle) =>
                coinRecord.coin.puzzle_hash === formatHex(puzzle.hashHex())
        );
    }

    public async sync(
        overrideOptions: Partial<WalletOptions> = {}
    ): Promise<void> {
        const options = { ...this.options, ...overrideOptions };

        let keyCount = this.keyStore.keys.length;
        let unusedCount = 0;

        for (let i = this.coinRecords.length - 1; i >= 0; i--) {
            const coinRecords = this.coinRecords[i];

            if (!coinRecords.length) unusedCount++;
            else break;
        }

        while (
            keyCount < options.maxAddressCount &&
            (unusedCount < options.unusedAddressCount ||
                keyCount < options.minAddressCount)
        ) {
            this.keyStore.generate(1);
            const keyPair = this.keyStore.keys.at(-1)!;
            const puzzle = this.createPuzzle(keyPair);
            const coinRecords = await this.node.getCoinRecordsByPuzzleHash(
                puzzle.hashHex(),
                undefined,
                undefined,
                true
            );
            if (!coinRecords.success) throw new Error(coinRecords.error);

            keyCount++;
            if (!coinRecords.coin_records.length) unusedCount++;
            else unusedCount = 0;
        }

        this.createPuzzles();

        await this.fetchCoinRecords();
    }

    public createPuzzles(): void {
        for (
            let i = this.puzzleCache.length;
            i < this.keyStore.keys.length;
            i++
        ) {
            this.puzzleCache[i] = this.createPuzzle(this.keyStore.keys[i]);
        }
    }

    public async fetchCoinRecords(): Promise<void> {
        const puzzleHashes = this.puzzleCache.map((puzzle) => puzzle.hashHex());

        const coinRecordResult = await this.node.getCoinRecordsByPuzzleHashes(
            puzzleHashes,
            undefined,
            undefined,
            true
        );

        if (!coinRecordResult.success) throw new Error(coinRecordResult.error);

        for (const artificialCoinRecord of this.artificialCoinRecords) {
            if (
                coinRecordResult.coin_records.find((coinRecord) =>
                    bytesEqual(
                        toCoinId(coinRecord.coin),
                        toCoinId(artificialCoinRecord.coin)
                    )
                )
            )
                this.artificialCoinRecords.splice(
                    this.artificialCoinRecords.indexOf(artificialCoinRecord)
                );
        }

        const coinRecords = coinRecordResult.coin_records.concat(
            this.artificialCoinRecords
        );

        const newCoinRecords: Array<CoinRecord[]> = [];

        for (const puzzleHash of puzzleHashes) {
            newCoinRecords.push(
                coinRecords.filter(
                    (coinRecord) =>
                        sanitizeHex(coinRecord.coin.puzzle_hash) === puzzleHash
                )
            );
        }

        Object.assign(this.coinRecords, newCoinRecords);
    }

    public async clearUnconfirmedTransactions(): Promise<void> {
        this.artificialCoinRecords.length = 0;

        await this.fetchCoinRecords();
    }

    public createSpend(): SpendBundle {
        return {
            coin_spends: [],
            aggregated_signature: JacobianPoint.infinityG2().toHex(),
        };
    }

    public async findUnusedIndices(
        amount: number,
        used: number[],
        presynced: boolean = false
    ): Promise<number[]> {
        const result: Array<number> = [];

        for (let i = 0; i <= this.coinRecords.length; i++) {
            const coinRecords = this.coinRecords[i];

            if (!coinRecords.length && !used.includes(i)) result.push(i);

            if (result.length === amount) break;
        }

        if (result.length < amount) {
            if (!presynced) {
                amount += used.length;

                await this.sync(
                    amount > this.options.unusedAddressCount
                        ? { unusedAddressCount: amount }
                        : undefined
                );

                return await this.findUnusedIndices(amount, used, true);
            } else throw new Error('Could not find enough unused indices.');
        }

        for (const index of result) used.push(index);

        return result;
    }

    public getBalance(): number {
        return this.coinRecords
            .flat()
            .filter(
                (coinRecord) =>
                    !coinRecord.spent && coinRecord.spent_block_index <= 0
            )
            .reduce(
                (balance, coinRecord) => balance + coinRecord.coin.amount,
                0
            );
    }

    public selectCoinRecords(
        amount: number,
        coinSelection: CoinSelection,
        minimumCoinRecords: number = 0,
        required: boolean = true
    ): CoinRecord[] {
        const coinRecords = this.coinRecords.flat();

        const viableCoinRecords = coinRecords.filter(
            (coinRecord) =>
                coinRecord.spent_block_index <= 0 || coinRecord.spent === false
        );

        switch (coinSelection) {
            case CoinSelection.Smallest:
                viableCoinRecords.sort((a, b) => a.coin.amount - b.coin.amount);
                break;
            case CoinSelection.Largest:
                viableCoinRecords.sort((a, b) => b.coin.amount - a.coin.amount);
                break;
            case CoinSelection.Newest:
                viableCoinRecords.sort((a, b) => b.timestamp - a.timestamp);
                break;
            case CoinSelection.Oldest:
                viableCoinRecords.sort((a, b) => a.timestamp - b.timestamp);
                break;
        }

        const selectedCoinRecords: Array<CoinRecord> = [];

        let totalAmount = 0;

        for (
            let i = 0;
            (totalAmount < amount ||
                selectedCoinRecords.length < minimumCoinRecords) &&
            i < viableCoinRecords.length;
            i++
        ) {
            const coinRecord = viableCoinRecords[i];
            selectedCoinRecords.push(coinRecord);
            totalAmount += coinRecord.coin.amount;
        }

        if (selectedCoinRecords.length < minimumCoinRecords)
            throw new Error('Insufficient number of coin records.');

        if (totalAmount < amount && required)
            throw new Error('Insufficient funds.');

        return selectedCoinRecords;
    }

    public abstract signSpend(
        spendBundle: SpendBundle,
        aggSigMeExtraData: Uint8Array
    ): void;

    public async completeSpend(spendBundle: SpendBundle): Promise<void> {
        const result = await this.node.pushTx(spendBundle);

        if (!result.success) throw new Error(result.error);

        if (!this.options.instantCoinRecords) return;

        const newCoinRecords: Array<CoinRecord> = [];

        for (const coinSpend of spendBundle.coin_spends) {
            const output = Program.deserializeHex(coinSpend.puzzle_reveal).run(
                Program.deserializeHex(coinSpend.solution)
            ).value;

            if (output.isCons) continue;

            const conditions = output.toList();

            for (const condition of conditions) {
                if (condition.isAtom) continue;

                const conditionData = condition.toList();

                if (
                    conditionData.length < 3 ||
                    conditionData[0].isCons ||
                    conditionData[1].isCons ||
                    conditionData[2].isCons
                )
                    continue;

                if (conditionData[0].toBigInt() !== 51n) continue;

                const puzzleHash = conditionData[1].toHex();
                const amount = conditionData[2].toInt();

                const coin: Coin = {
                    parent_coin_info: formatHex(
                        toHex(toCoinId(coinSpend.coin))
                    ),
                    puzzle_hash: formatHex(puzzleHash),
                    amount,
                };

                const coinRecord: CoinRecord = {
                    coin,
                    confirmed_block_index: 0,
                    spent_block_index: 0,
                    spent: false,
                    coinbase: false,
                    timestamp: Date.now(),
                };

                for (const check of spendBundle.coin_spends) {
                    if (bytesEqual(toCoinId(check.coin), toCoinId(coin))) {
                        coinRecord.spent_block_index = 1;
                        coinRecord.spent = true;
                    }
                }

                newCoinRecords.push(coinRecord);
            }
        }

        for (const coinRecord of newCoinRecords)
            this.artificialCoinRecords.push(coinRecord);

        await this.fetchCoinRecords();
    }
}
