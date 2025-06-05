const fs = require('fs-extra');
const solc = require('solc');
const { Web3 } = require('web3');

const web3 = new Web3('http://127.0.0.1:7545'); // Ganache

const source = fs.readFileSync('IpfsStorage.sol', 'utf8');

// Compilazione
const input = {
  language: 'Solidity',
  sources: {
    'IpfsStorage.sol': { content: source },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const contractFile = output.contracts['IpfsStorage.sol']['IpfsStorage'];

const abi = contractFile.abi;
const bytecode = contractFile.evm.bytecode.object;

async function deploy() {
  const accounts = await web3.eth.getAccounts();
  console.log('Deploying from account:', accounts[0]);

  const contract = new web3.eth.Contract(abi);

  const deployed = await contract.deploy({ data: '0x' + bytecode })
    .send({ from: accounts[0], gas: 1500000 });

  console.log('Contract deployed at:', deployed.options.address);

  // Salva ABI per uso futuro
  fs.outputJsonSync('IpfsStorageAbi.json', abi);
}

deploy();
