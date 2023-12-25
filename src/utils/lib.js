/* global BigInt */
import Web3 from 'web3';
import cdpContractAbi from '../abi/cdpContract.json';
import ilksContractAbi from '../abi/ilksContract.json';
import { utils } from '@defisaver/tokens';

export const { bytesToString, stringToBytes } = utils;

export const ethPrice = 2210;
export const btcPrice = 43673;
export const usdcPrice = 1;

export const ethLiquidationRatio = 1.45
export const btcLiquidationRatio = 1.45
export const usdcLiquidationRatio = 1.01

// dont abuse :(
export const infuraUrl = 'https://mainnet.infura.io/v3/ad50eea220664648bb73c67408ad8209';

export const web3 = new Web3(infuraUrl);

export const cdpContractAddress = '0x68C61AF097b834c68eA6EA5e46aF6c04E8945B2d';
export const cdpContract = new web3.eth.Contract(cdpContractAbi, cdpContractAddress);

export const ilksContractAddress = '0x35d1b3f3d7966a1dfe207aa4514c12a259a0492b';
export const ilksContract = new web3.eth.Contract(ilksContractAbi, ilksContractAddress);

export const tokenInfo = {
    "ETH-A": {
        price: ethPrice,
        liquidationRatio: ethLiquidationRatio
    },
    "WBTC-A": {
        price: btcPrice,
        liquidationRatio: btcLiquidationRatio
    },
    "USDC-A": {
        price: usdcPrice,
        liquidationRatio: usdcLiquidationRatio
    }
};

export const fetchIlkRate = async (ilk) => {
    try {
        const response = await ilksContract.methods.ilks(stringToBytes(ilk)).call();
        return response.rate;
    } catch (error) {
        console.error('Error fetching ilk rate:', error);
        return null;
    }
};

export const formatCollateral = (collateral) => {
    const divisor = BigInt(10) ** BigInt(18); // 1e18
    return Number(collateral * 100n / divisor) / 100;
};

export const formatDebt = (debt) => {
    // 1e45 because debt it multiplied with rate (debtWithoutRate[wad] * rate[ray] = debtWithRate[rad])
    const divisor = BigInt(10) ** BigInt(45);
    return Number(debt * 100n / divisor) / 100;
};

export const calculateCollateralizationRatio = (collateral, debt, collateralType) => {
    if (debt === 0n) {
        return 0;
    }
    const precision = 10000;
    const collateralInUsd = collateral * BigInt(tokenInfo[collateralType].price)
    // 27n because debt is multiplied with rate
    const ratio = Number(collateralInUsd * 10n ** 27n * BigInt(precision) / debt) / precision
    return ratio;
};

export const calculateMaxCollateral = (collateral, liquidationRatio) => {
    if (liquidationRatio === 0) return 0n;
    const precision = 10000;
    const maxCollateral = collateral * BigInt(precision) / BigInt(liquidationRatio * precision);
    return maxCollateral;
};

export function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}