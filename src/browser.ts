import * as ChiaWallet from './index';

declare global {
    interface Window {
        ChiaWallet: typeof ChiaWallet;
    }
}

window.ChiaWallet = ChiaWallet;
