import { bytesEqual, JacobianPoint, toHex } from 'chia-bls';
import {
    Coin,
    CoinRecord,
    formatHex,
    FullNode,
    sanitizeHex,
    SpendBundle,
    toCoinId,
} from 'chia-rpc';
import { Program } from 'clvm-lib';
import { CoinSelection } from './CoinSelection';
import { KeyStore } from './KeyStore';

export interface WalletOptions {
    batchSize: number;
    minimumUnused: number;
    maxDerivations: number;
    updatePendingCoinRecords: boolean;
}

const defaultWalletOptions: WalletOptions = {
    batchSize: 50,
    minimumUnused: 10,
    maxDerivations: Infinity,
    updatePendingCoinRecords: true,
};

export abstract class Wallet<T extends Program> {
    public readonly node: FullNode;
    public readonly keyStore: KeyStore;
    public readonly options: WalletOptions;

    public readonly coinRecords: Array<CoinRecord[]> = [];
    public readonly artificialCoinRecords: Array<CoinRecord> = [];
    public readonly puzzleHashes: Array<Uint8Array> = [];

    constructor(
        node: FullNode,
        keyStore: KeyStore,
        walletOptions: Partial<WalletOptions> = {}
    ) {
        this.node = node;
        this.keyStore = keyStore;
        this.options = { ...defaultWalletOptions, ...walletOptions };
    }

    public abstract createPuzzle(index: number): T;

    // TODO: This can be overridden for performance if needed.
    public createPuzzleHash(index: number): Uint8Array {
        return this.createPuzzle(index).hash();
    }

    public derivationIndexOf(puzzleHash: Uint8Array): number {
        return this.puzzleHashes.findIndex((hash) =>
            bytesEqual(hash, puzzleHash)
        );
    }

    private unusedIndex(): number {
        return this.coinRecords.findLastIndex(
            (coinRecords) => !coinRecords.length
        );
    }

    public async sync(
        overrideOptions: Partial<WalletOptions> = {}
    ): Promise<void> {
        const options = { ...this.options, ...overrideOptions };

        while (
            // There aren't enough unused derivations.
            this.unusedIndex() < options.minimumUnused &&
            // There aren't too many keys.
            this.coinRecords.length < options.maxDerivations
        ) {
            // Derive up to the maximum number of keys.
            const count = Math.min(
                options.batchSize,
                options.maxDerivations - this.coinRecords.length
            );
            this.keyStore.generate(this.coinRecords.length + count);
            this.createPuzzles();
            await this.fetchCoinRecords();
        }
    }

    public createPuzzles(): void {
        for (
            let i = this.puzzleHashes.length;
            i < this.keyStore.keys.length;
            i++
        ) {
            this.puzzleHashes.push(this.createPuzzleHash(i));
        }
    }

    public async fetchCoinRecords(): Promise<void> {
        const puzzleHashes = this.puzzleHashes.map((puzzle) => toHex(puzzle));

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
                    amount > this.options.minimumUnused
                        ? { minimumUnused: amount }
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

        if (!this.options.updatePendingCoinRecords) return;

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
