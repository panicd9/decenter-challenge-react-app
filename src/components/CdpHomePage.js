/* eslint-disable no-loop-func */
/* global BigInt */
import React, { useState } from 'react';
import { set, utils } from '@defisaver/tokens';
import { Buffer } from 'buffer';
import { Link } from 'react-router-dom';
import Pqueue from 'p-queue';
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
    const [foundCdpCount, setFoundCdpCount] = useState(0);

    const fetchCdpList = async () => {
        setLoading(true);
        let foundCdpCount = 0;
        let searchDistanceUp = 0;
        let searchDistanceDown = 1; // start from -1 to avoid searching the same cdp twice
        const queue = new Pqueue({ concurrency: 5 });
    
        const cdpFound = new Promise((resolve) => {
            const processCdpData = async (cdpId) => {
                const cdpData = await fetchCdpData(cdpId);
    
                if (cdpData.debt === 0n && cdpData.collateral === 0n) {
                    return;
                }
    
                const ilk = bytesToString(cdpData.ilk);
                if (ilk !== collateralType) {
                    return;
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
                setFoundCdpCount(foundCdpCount);
                console.log('Found CDP:', cdpData);
    
                if (foundCdpCount >= 20) {
                    resolve();
                }
            };
    
            // Search up
            const addTaskToQueueUp = async () => {
                const searchUpId = Number(roughCdpId) + searchDistanceUp;
    
                if (searchUpId > 0) {
                    queue.add(() => processCdpData(searchUpId)).then(() => {
                        if (foundCdpCount < 20) {
                            addTaskToQueueUp();
                        }
                    });
                }

                searchDistanceUp++;
            };

            // Search down
            const addTaskToQueueDown = async () => {
                const searchDownId = Number(roughCdpId) - searchDistanceDown;
                if (searchDownId > 0) {
                    queue.add(() => processCdpData(searchDownId)).then(() => {
                        if (foundCdpCount < 20) {
                            addTaskToQueueDown();
                        }
                    });
                }
    
                searchDistanceDown++;
            };
    
            // Add initial tasks to the queue
            for (let i = 0; i < 3; i++) {
                addTaskToQueueUp();
            }

            for (let i = 0; i < 2; i++) {
                addTaskToQueueDown();
            }
        });
    
        await cdpFound;
    
        console.log('Found cdp count:', foundCdpCount);
        console.log('Queue size:', queue.size);
        console.log("Queue pending:", queue.pending);
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
                {loading ? <p>Found CDPs: {foundCdpCount}/20</p> : null}
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
