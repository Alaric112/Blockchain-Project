const fs = require('fs-extra');
const solc = require('solc');
const { Web3 } = require('web3');
const path = require('path');

// Funzione per risolvere gli import
function findImports(importPath) {
    // Risolve il percorso rispetto alla root del progetto
    const basePath = path.resolve(__dirname, '..'); // Vai su dalla cartella Phase4
    const fullPath = path.resolve(basePath, importPath);
    try {
        return { contents: fs.readFileSync(fullPath, 'utf8') };
    } catch (e) {
        return { error: 'File not found: ' + fullPath };
    }
}

// Function to read the Solidity file
function readContract(contractName) {
    const contractPath = path.resolve(__dirname, contractName);
    return fs.readFileSync(contractPath, 'utf8');
}

// Read contracts
const nftSource = readContract('../Phase3/MyTokenNFT.sol');
const IpfsStorageSource = readContract('IpfsStorage.sol');

// Compilazione
const input = {
  language: 'Solidity',
  sources: {
    'MyTokenNFT.sol' : { content: nftSource},
    'IpfsStorage.sol': { content: IpfsStorageSource },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode'],
      }
    }
  }
};

// Compilazione con callback per gli import
const compiledContracts = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports })
);

if (compiledContracts.errors) {
    compiledContracts.errors.forEach(err => {
        console.error(err.formattedMessage);
    });
    throw new Error('Compilation failed');
}

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
writeOutput('IpfsStorage.sol', 'IpfsStorage');

console.log('All contracts compiled successfully!');