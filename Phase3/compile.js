const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Reads the Solidity file for the NFT
const contractPath = path.resolve(__dirname, 'PurchaseAndMint.sol');
const sourceCode = fs.readFileSync(contractPath, 'utf8');

// Compiles the contract
const input = {
    language: 'Solidity',
    sources: {
        'PurchaseAndMint.sol': { content: sourceCode },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['*'],
            },
        },
    },
};

const compiledContract = JSON.parse(solc.compile(JSON.stringify(input)));

// Extracts the ABI and Bytecode
const abi = compiledContract.contracts['PurchaseAndMint.sol'].PurchaseAndMint.abi;
const bytecode = compiledContract.contracts['PurchaseAndMint.sol'].PurchaseAndMint.evm.bytecode.object;

// Saves ABI and Bytecode to files
fs.writeFileSync('PurchaseAndMint.json', JSON.stringify(abi, null, 2));
fs.writeFileSync('PurchaseAndMint.bin', bytecode);

console.log(' Compilation successful!');