const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Function to read the Solidity file
function readContract(contractName) {
    const contractPath = path.resolve(__dirname, contractName);
    return fs.readFileSync(contractPath, 'utf8');
}

// Read contracts
const nftSource = readContract('MyTokenNFT.sol');
const purchaseAndMintSource = readContract('PurchaseAndMint.sol');

// Compiles the contracts
const input = {
    language: 'Solidity',
    sources: {
        'MyTokenNFT.sol': { content: nftSource },
        'PurchaseAndMint.sol': { content: purchaseAndMintSource },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode'],
            },
        },
    },
};

const compiledContracts = JSON.parse(solc.compile(JSON.stringify(input)));

if (compiledContracts.errors) {
    compiledContracts.errors.forEach(err => {
        console.error(err.formattedMessage);
    });
    throw new Error('Compilation failed');
}

console.log('Contracts keys:', Object.keys(compiledContracts.contracts));
// Function to write ABI and Bytecode
function writeOutput(fileName, contractName) {
    const contractOutput = compiledContracts.contracts[fileName][contractName];

    if (!contractOutput) {
        console.error(`Error: Contract ${contractName} not found in ${fileName}.`);
        process.exit(1);
    }

    const abi = contractOutput.abi;
    const bytecode = contractOutput.evm.bytecode.object;

    fs.writeFileSync(`${contractName}Abi.json`, JSON.stringify(abi, null, 2));
    fs.writeFileSync(`${contractName}Bytecode.bin`, bytecode);

    console.log(`${contractName} compiled successfully!`);
}

// Write ABI and Bytecode files for each contract
writeOutput('MyTokenNFT.sol', 'MyTokenNFT');
writeOutput('PurchaseAndMint.sol', 'PurchaseAndMint');

console.log('All contracts compiled successfully!');