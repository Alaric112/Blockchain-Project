const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Function to read the Solidity file
function readContract(contractName) {
    const contractPath = path.resolve(__dirname, contractName);
    return fs.readFileSync(contractPath, 'utf8');
}

const votingSource = readContract('VotingAndRewards.sol'); 
const rewardTokenSource = readContract('RewardToken.sol');

// Compiles the contract
const input = {
    language: 'Solidity',
    sources: {
        'VotingAndRewards.sol': { content: votingSource },
        'RewardToken.sol': { content: rewardTokenSource },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['*'],
            },
        },
    },
};

const compiledContracts = JSON.parse(solc.compile(JSON.stringify(input)));

if (compiledContracts.errors) {
    compiledContracts.errors.forEach(err => {
        console.error(err.formattedMessage);
    });
    
    // Check if there are fatal errors
    const fatalErrors = compiledContracts.errors.filter(err => err.severity === 'error');
    if (fatalErrors.length > 0) {
        throw new Error('Compilation failed with errors');
    }
}

console.log('Contracts keys:', Object.keys(compiledContracts.contracts));

// Function to write ABI and Bytecode
function writeOutput(fileName, contractName) {
    const contractOutput = compiledContracts.contracts[fileName][contractName];

    if (!contractOutput) {
        console.error(`Error: Contract ${contractName} not found in ${fileName}.`);
        console.log('Available contracts:', Object.keys(compiledContracts.contracts[fileName] || {}));
        process.exit(1);
    }

    const abi = contractOutput.abi;
    const bytecode = contractOutput.evm.bytecode.object;

    fs.writeFileSync(`${contractName}Abi.json`, JSON.stringify(abi, null, 2));
    fs.writeFileSync(`${contractName}Bytecode.bin`, bytecode);

    console.log(`${contractName} compiled successfully!`);
}

// Write ABI and Bytecode files for each contract
writeOutput('RewardToken.sol', 'RewardToken');
writeOutput('VotingAndRewards.sol', 'VotingAndRewards');

console.log('All contracts compiled successfully!');