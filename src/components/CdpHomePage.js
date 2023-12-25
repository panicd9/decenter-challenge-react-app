/* eslint-disable no-loop-func */
/* global BigInt */
import React, { useState } from 'react';
import { utils } from '@defisaver/tokens';
import { Buffer } from 'buffer';
import { Link } from 'react-router-dom';
import { cdpContract, ilksContract, formatDebt, formatCollateral, numberWithCommas } from '../utils/lib.js';
import '../styles/CdpHomePage.css';

const { bytesToString, stringToBytes } = utils;

window.Buffer = Buffer;

const debounce = (func, delay) => {
    let timer;
    return function () {
        const context = this;
        const args = arguments;
        if (!timer) {
            func.apply(context, args);
        }
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
        }, delay);
    };
};

const fetchCdpData = async (cdpId) => {
    try {
        console.log('Fetching CDP data: ', cdpId);
        let response = await cdpContract.methods.getCdpInfo(cdpId).call();
        response.id = cdpId;
        return response;
    } catch (error) {
        console.error('Error fetching CDP data:', error);
        return null;
    }
};

const fetchIlkRate = async (ilk) => {
    try {
        const response = await ilksContract.methods.ilks(stringToBytes(ilk)).call();
        return response.rate;
    } catch (error) {
        console.error('Error fetching ilk rate:', error);
        return null;
    }
};

const CdpHomePage = () => {
    const collateralTypes = ["ETH-A", "WBTC-A", "USDC-A"];
    const [collateralType, setCollateralType] = useState(collateralTypes[0]);
    const [roughCdpId, setRoughCdpId] = useState('');
    const [cdpList, setCdpList] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchCdpList = async () => {
        setLoading(true);
        let foundCdpCount = 0;
        let searchDistance = 0;
        let activePromises = 0;
        const maxActivePromises = 5;
        const promiseQueue = [];

        const processQueue = async (cdpId) => {
            if (foundCdpCount >= 20 || activePromises >= maxActivePromises || promiseQueue.length === 0) {
                return;
            }

            activePromises++;
            const promise = promiseQueue.shift();
            const cdpData = await promise;

            if (cdpData.debt === 0n && cdpData.collateral === 0n) {
                activePromises--;
                processQueue();
                return;
            }

            const ilk = bytesToString(cdpData.ilk);
            if (ilk !== collateralType) {
                activePromises--;
                processQueue();
                return; // Skip CDPs with a different collateral type
            }

            const rate = await fetchIlkRate(ilk);
            const formattedCdp = {
                id: cdpData.id,
                collateralType: ilk,
                collateral: cdpData.collateral,
                debt: BigInt(cdpData.debt) * rate,
            };

            setCdpList(prevCdpList => { return [...prevCdpList, formattedCdp] });

            foundCdpCount++;
            console.log('Found CDP:', cdpData);
            activePromises--;
            processQueue();
        };

        while (foundCdpCount < 20) {
            const searchUpId = Number(roughCdpId) + searchDistance;
            const searchDownId = Number(roughCdpId) - searchDistance;

            if (searchUpId > 0) {
                promiseQueue.push(fetchCdpData(searchUpId));
            }

            if (searchDownId > 0 && searchDownId !== searchUpId) {
                promiseQueue.push(fetchCdpData(searchDownId));
            }

            while (activePromises < maxActivePromises && promiseQueue.length > 0) {
                processQueue();
            }

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for promises to resolve
            searchDistance++;
        }

        console.log('Found cdp count:', foundCdpCount);
        setLoading(false);
    };

    const debouncedFetchCdpList = React.useCallback(debounce(fetchCdpList, 500), [roughCdpId, collateralType]);

    const handleFetchButtonClick = () => {
        if (loading) return;

        setCdpList([]);
        debouncedFetchCdpList();
    };

    return (
        <div className="cdp-home">
            <h1 className="cdp-home__title">MakerDAO CDP Tool</h1>
            <div className="cdp-home__controls">
                <div className="cdp-home__control">
                    <label>Collateral Type:</label>
                    <select value={collateralType} onChange={(e) => setCollateralType(e.target.value)}>
                        {collateralTypes.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="cdp-home__control">
                    <label>Rough CDP ID:</label>
                    <input type="number" value={roughCdpId} onChange={(e) => setRoughCdpId(e.target.value)} />
                </div>
                <button className="cdp-home__button" onClick={handleFetchButtonClick} disabled={loading} style={{ backgroundColor: loading ? 'gray' : 'blue' }}>
                    Fetch CDPs
                </button>
            </div>
            <div className="cdp-home__list">
                {loading ? <p>Loading...</p> : null}
                {cdpList.sort((a, b) => a.id - b.id).map((cdp) => (
                    <div key={cdp.id} className="cdp-home__item">
                        <p>ID: {cdp.id}</p>
                        <p>Collateral Type: {cdp.collateralType}</p>
                        <p>Collateral: {numberWithCommas(formatCollateral(cdp.collateral))}</p>
                        <p>Debt: {numberWithCommas(formatDebt(cdp.debt))}</p>
                        <Link to={`/cdp/${cdp.id}`}>Details for CDP {cdp.id}</Link>
                        <hr />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CdpHomePage;
