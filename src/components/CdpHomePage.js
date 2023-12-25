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

function rpcCallRunner(maxConcurrency) {
    let activeRpcCalls = 0;
    const rpcCallQueue = [];

    function runRpcCall(rpcCall) {
        activeRpcCalls++;
        console.log(`Running RPC call. Active calls: ${activeRpcCalls}`);
        rpcCall().finally(() => {
            activeRpcCalls--;
            console.log(`Finished RPC call. Active calls: ${activeRpcCalls}`);
            if (rpcCallQueue.length > 0) {
                runRpcCall(rpcCallQueue.shift());
            }
        });
    }

    return function (rpcCall) {
        if (activeRpcCalls < maxConcurrency) {
            runRpcCall(rpcCall);
        } else {
            console.log(`Queueing RPC call. Queue length: ${rpcCallQueue.length}`);
            rpcCallQueue.push(rpcCall);
        }
    };
}

const CdpHomePage = () => {
    const collateralTypes = ["ETH-A", "WBTC-A", "USDC-A"];
    const [collateralType, setCollateralType] = useState(collateralTypes[0]);
    const [roughCdpId, setRoughCdpId] = useState('');
    const [cdpList, setCdpList] = useState([]);
    const [loading, setLoading] = useState(false);
    // const [disableFetchOnType, setDisableFetchOnType] = useState(true);

    const runner = rpcCallRunner(5);

    const fetchCdpList = async () => {
        setLoading(true);
        const startCdpId = Math.max(roughCdpId - 10, 1);
        const endCdpId = startCdpId + 20;

        for (let id = startCdpId; id < endCdpId; id++) {
            runner(() => fetchCdpData(id).then(cdpData => {
                if (!cdpData) return;

                const ilk = bytesToString(cdpData.ilk);
                fetchIlkRate(ilk).then(rate => {
                    const formattedCdp = {
                        id: cdpData.id,
                        collateralType: ilk,
                        collateral: cdpData.collateral,
                        debt: BigInt(cdpData.debt) * rate,
                    };

                    setCdpList(prevCdpList => [...prevCdpList, formattedCdp]);
                });
            }));
        }

        setLoading(false);
    };

    const debouncedFetchCdpList = React.useCallback(debounce(fetchCdpList, 500), [roughCdpId]);

    const handleFetchButtonClick = () => {
        if(loading) return;
        
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
                <button className="cdp-home__button" onClick={handleFetchButtonClick} disabled={loading}>
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
