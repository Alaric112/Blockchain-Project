const { Web3 } = require('web3');
const fs = require('fs');

// Correct connection to the local Ganache instance (verify the Ganache port!)
const web3 = new Web3('HTTP://127.0.0.1:7545');

// Load ABI and Bytecode generated from the compile.js file
const nftAbi = JSON.parse(fs.readFileSync('MyTokenNFTAbi.json', 'utf8'));
const nftBytecode = fs.readFileSync('MyTokenNFTBytecode.bin', 'utf8');

// Load ABI and Bytecode generated from the compile.js file
const abi = JSON.parse(fs.readFileSync('PurchaseAndMintAbi.json', 'utf8'));
const bytecode = fs.readFileSync('PurchaseAndMintBytecode.bin', 'utf8');

async function deployContract() {
    // Retrieve available accounts from Ganache
    const accounts = await web3.eth.getAccounts();

    console.log(' Deploying from account:', accounts[0]);

    const MyTokenNFT = new web3.eth.Contract(nftAbi);
    const nftDeployed = await MyTokenNFT
        .deploy({ data: '0x' + nftBytecode }) // nessun parametro in constructor
        .send({ from: accounts[0], gas: 4000000 });

    console.log(' MyTokenNFT deployed at address:', nftDeployed.options.address);

    // Create a new contract instance
    const contract = new web3.eth.Contract(abi);

    // Deploy the contract using the bytecode
    const deployedContract = await contract
        .deploy({ data: '0x' + bytecode, arguments: [nftDeployed.options.address] })
        .send({ from: accounts[0], gas: 4000000 });

    console.log(' Contract successfully deployed at address:', deployedContract.options.address);
}

// Call the deploy function and handle errors
deployContract().catch(console.error);