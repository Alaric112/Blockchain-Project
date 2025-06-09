const { Web3 } = require('web3');
const fs = require('fs');

// Correct connection to the local Ganache instance (verify the Ganache port!)
const web3 = new Web3('HTTP://127.0.0.1:7545');

// Load ABI and Bytecode generated from the compile.js file
const nftAddress = '0xd39E70A7C40583a9883a3B2792223e2B0F444D1D'; // indirizzo del contratto MyTokenNFT già deployato in Phase3

// Load ABI and Bytecode generated from the compile.js file
const abi = JSON.parse(fs.readFileSync('IpfsStorageAbi.json', 'utf8'));
const bytecode = fs.readFileSync('IpfsStorageBytecode.bin', 'utf8');

async function deployContract() {
    // Retrieve available accounts from Ganache
    const accounts = await web3.eth.getAccounts();

    console.log(' Deploying from account:', accounts[0]);

    // Create a new contract instance
    const contract = new web3.eth.Contract(abi);

    // Deploy the contract using the bytecode
    const deployedContract = await contract
        .deploy({ data: '0x' + bytecode, arguments: [nftAddress] })
        .send({ from: accounts[0], gas: 5000000 });

    console.log(' Contract successfully deployed at address:', deployedContract.options.address);
}

// Call the deploy function and handle errors
deployContract().catch(console.error);