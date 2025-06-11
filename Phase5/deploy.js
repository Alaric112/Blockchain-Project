const { Web3 } = require('web3');
const fs = require('fs');

// Correct connection to the local Ganache instance (verify the Ganache port!)
const web3 = new Web3('HTTP://127.0.0.1:7545');

// Load ABI and Bytecode generated from the compile.js file
const rewardTokenAbi = JSON.parse(fs.readFileSync('RewardTokenAbi.json', 'utf8'));
const rewardTokenBytecode = fs.readFileSync('RewardTokenBytecode.bin', 'utf8');

// Load ABI and Bytecode generated from the compile.js file
const votingAbi = JSON.parse(fs.readFileSync('VotingAndRewardsAbi.json', 'utf8'));
const votingBytecode = fs.readFileSync('VotingAndRewardsBytecode.bin', 'utf8');

async function deployContract() {
    // Retrieve available accounts from Ganache
    const accounts = await web3.eth.getAccounts();

    console.log(' Deploying from account:', accounts[0]);

    const RewardToken = new web3.eth.Contract(rewardTokenAbi);
    const rewardTokenDeployed = await RewardToken
        .deploy({ data: '0x' + rewardTokenBytecode, arguments: [1000000] }) // Initial supply: 1,000,000 tokens
        .send({ from: accounts[0], gas: 5000000 });

    console.log(' RewardToken deployed at address:', rewardTokenDeployed.options.address);

    // Create a new contract instance
    const contract = new web3.eth.Contract(votingAbi);

    // Deploy the contract using the bytecode
    const deployedContract = await contract
        .deploy({ data: '0x' + votingBytecode, arguments: [rewardTokenDeployed.options.address] })
        .send({ from: accounts[0], gas: 5000000 });

    console.log(' Contract successfully deployed at address:', deployedContract.options.address);
}

// Call the deploy function and handle errors
deployContract().catch(console.error);