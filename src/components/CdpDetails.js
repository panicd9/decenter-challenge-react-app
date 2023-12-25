/* global BigInt */
import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import { useParams } from 'react-router-dom';
import { cdpContract, tokenInfo, bytesToString, fetchIlkRate, formatCollateral, calculateCollateralizationRatio, calculateMaxCollateral, formatDebt, numberWithCommas } from '../utils/lib.js';
import '../styles/CdpDetails.css';

const signMessage = async (web3, message) => {
    try {
        const accounts = await web3.eth.requestAccounts();
        const address = accounts[0];
        const signature = await web3.eth.personal.sign(message, address, "");
        return signature;
    } catch (error) {
        console.error('Error signing message:', error);
        return null;
    }
};

const CdpDetails = () => {
	const { cdpId } = useParams();
	const [cdpDetails, setCdpDetails] = useState(null);
	const [userSignature, setUserSignature] = useState(null);

    const handleSignMessage = async () => {
        if (window.ethereum) {
            const web3 = new Web3(window.ethereum);
            try {
                const signature = await signMessage(web3, 'Ovo je moj CDP');
                setUserSignature(signature);
            } catch (error) {
                console.error('Error signing message:', error);
            }
        } else {
            console.warn('Metamask not detected. Please install or enable Metamask.');
        }
    };

	useEffect(() => {
		const fetchCdpData = async () => {
			try {
				let response = await cdpContract.methods.getCdpInfo(cdpId).call();
				const ilk = bytesToString(response.ilk);
				const rate = await fetchIlkRate(ilk);
	
				const formattedCdp = {
					id: cdpId,
					collateralType: ilk,
					collateral: response.collateral,
					debt: BigInt(response.debt) * rate,
				};
				setCdpDetails(formattedCdp);
			} catch (error) {
				console.error('Error fetching CDP data:', error);
				return null;
			}
		};

		fetchCdpData();
	}, [cdpId]);

	if (!cdpDetails) {
		return <p>Loading...</p>;
	}

	const precision = 100;

	const collateralizationRatio = calculateCollateralizationRatio(cdpDetails.collateral, cdpDetails.debt, cdpDetails.collateralType);
	const liquidationRatio = tokenInfo[cdpDetails.collateralType]?.liquidationRatio || 0;
	const price = tokenInfo[cdpDetails.collateralType]?.price || 0;
	const maxCollateral = calculateMaxCollateral(cdpDetails.collateral, liquidationRatio);
	const maxDebt = cdpDetails.collateral * BigInt(price * precision) * BigInt(liquidationRatio * precision - precision) / BigInt(precision ** 2)

	return (
		<div className="cdp-details">
			<h2 className="cdp-details__title">CDP {cdpDetails.id} Details</h2>
			<div className="cdp-details__info">
				<p>Collateral Type: {cdpDetails.collateralType}</p>
				<p>Collateral: {numberWithCommas(formatCollateral(cdpDetails.collateral))}</p>
				<p>Debt: {numberWithCommas(formatDebt(cdpDetails.debt))}</p>
				<p>Collateralization Ratio: {collateralizationRatio * 100}%</p>
				<p>Liquidation Ratio: {liquidationRatio * 100}%</p>
				<p>Max collateral to be withdrawn without liquidation: {numberWithCommas(Number(maxCollateral * BigInt(precision) / BigInt(10 ** 18)) / precision)} </p>
				<p>Max debt to be made without liquidation: {numberWithCommas(Number(maxDebt * BigInt(precision) / BigInt(10 ** 18)) / precision)} </p>
			</div>
			<button className="cdp-details__button" onClick={handleSignMessage}>Sign Message</button>
			{userSignature && (
				<div className="cdp-details__signature">
					<p>User Signature: {userSignature}</p>
				</div>
			)}
		</div>
	);
};

export default CdpDetails;
