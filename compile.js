const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Reads the Solidity file for the NFT
const contractPath = path.resolve(__dirname, 'EthrDIDRegistry.sol');
const sourceCode = fs.readFileSync(contractPath, 'utf8');

// Compiles the contract
const input = {
    language: 'Solidity',
    sources: {
        'EthrDIDRegistry.sol': { content: sourceCode },
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
const abi = compiledContract.contracts['EthrDIDRegistry.sol'].EthereumDIDRegistry.abi;
const bytecode = compiledContract.contracts['EthrDIDRegistry.sol'].EthereumDIDRegistry.evm.bytecode.object;

// Saves ABI and Bytecode to files
fs.writeFileSync('EthrDIDRegistryAbi.json', JSON.stringify(abi, null, 2));
fs.writeFileSync('EthrDIDRegistryBytecode.bin', bytecode);

console.log(' Compilation successful!');