const { Web3 } = require('web3');
const fs = require('fs');

// Connect to Ganache
const web3 = new Web3('http://127.0.0.1:7545');

// Carichiamo l’ABI di MyTokenNFT (soulbound)
const abi = JSON.parse(fs.readFileSync('MyTokenNFTAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0x6736CE9B69aeeC1FC40801658e7174eA0FE223e9';

// Creiamo l’istanza del contratto
const contract = new web3.eth.Contract(abi, contractAddress);

async function interactWithContract() {

    // Preleviamo gli account offerti da Ganache
    const accounts = await web3.eth.getAccounts();

    // Per semplicità: merchant = account1, buyer = account2
    const merchant = accounts[1];
    const buyer    = accounts[2];

    // Listen to the event
    contract.events.Transfer()
    .on('data', (event) => {
        console.log('Transferred token Event:', event.returnValues);
    });

}