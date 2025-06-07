const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Reads the Solidity file for the NFT
const contractPath = path.resolve(__dirname, 'Voting.sol');
const sourceCode = fs.readFileSync(contractPath, 'utf8');

// Compiles the contract
const input = {
    language: 'Solidity',
    sources: {
        'Voting.sol': { content: sourceCode },
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
const abi = compiledContract.contracts['Voting.sol'].Voting.abi;
const bytecode = compiledContract.contracts['Voting.sol'].Voting.evm.bytecode.object;

// Saves ABI and Bytecode to files
fs.writeFileSync('VotingAbi.json', JSON.stringify(abi, null, 2));
fs.writeFileSync('VotingBytecode.bin', bytecode);

console.log(' Compilation successful!');