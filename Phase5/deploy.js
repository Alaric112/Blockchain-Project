const { Web3 } = require('web3');
const fs = require('fs');

// Connessione alla tua rete (Ganache in locale ad esempio)
const web3 = new Web3('HTTP://127.0.0.1:7545');

// Carica ABI e Bytecode generati dal compile.js
const abi = JSON.parse(fs.readFileSync('VotingAbi.json', 'utf8'));
const bytecode = fs.readFileSync('VotingBytecode.bin', 'utf8');

async function deployContract() {
    // Recupera gli account disponibili
    const accounts = await web3.eth.getAccounts();

    console.log(' Deploying from account:', accounts[0]);

    // Indirizzo del contratto ProofOfPurchaseNFT:
    // → Se hai già deployato il contratto NFT, scrivi qui il vero indirizzo


    // → Per test puoi anche usare un account a caso di Ganache, ad esempio:
    const proofOfPurchaseNFTAddress = '0x382EbD9662C8b920E2097D7C7Fc9beabBE68DEeA';

    // Crea l'istanza del contratto
    const contract = new web3.eth.Contract(abi);

    // Fai il deploy del contratto con l'argomento richiesto
    const deployedContract = await contract
        .deploy({ 
            data: '0x' + bytecode, 
            arguments: [proofOfPurchaseNFTAddress] // IMPORTANTE: qui serve l'argomento del constructor
        })
        .send({ 
            from: accounts[0], 
            gas: 3000000, 
            gasPrice: '30000000000' 
        });

    console.log(' Contract successfully deployed at address:', deployedContract.options.address);
}

// Esegui la funzione di deploy e cattura eventuali errori
deployContract().catch(console.error);
