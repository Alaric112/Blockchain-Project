const { Web3 } = require('web3');
const fs = require('fs');

// Connessione alla tua rete (Ganache in locale ad esempio)
const web3 = new Web3('HTTP://127.0.0.1:7545');

async function deployContracts() {
    try {
        // Recupera gli account disponibili
        const accounts = await web3.eth.getAccounts();
        console.log('Deploying from account:', accounts[0]);

        // ===== DEPLOY REWARD TOKEN FIRST =====
        const rewardTokenAbi = JSON.parse(fs.readFileSync('RewardTokenAbi.json', 'utf8'));
        const rewardTokenBytecode = fs.readFileSync('RewardTokenBytecode.bin', 'utf8');

        console.log('\n=== Deploying RewardToken ===');
        const rewardTokenContract = new web3.eth.Contract(rewardTokenAbi);
        
        const deployedRewardToken = await rewardTokenContract
            .deploy({ 
                data: '0x' + rewardTokenBytecode, 
                arguments: [1000000] // Initial supply: 1,000,000 tokens
            })
            .send({ 
                from: accounts[0], 
                gas: 2000000, 
                gasPrice: '30000000000' 
            });

        console.log('RewardToken deployed at:', deployedRewardToken.options.address);

        // ===== DEPLOY VOTING AND REWARDS CONTRACT =====
        const votingAbi = JSON.parse(fs.readFileSync('VotingAndRewardsAbi.json', 'utf8'));
        const votingBytecode = fs.readFileSync('VotingAndRewardsBytecode.bin', 'utf8');

        console.log('\n=== Deploying VotingAndRewards ===');
        const votingContract = new web3.eth.Contract(votingAbi);

        const deployedVotingContract = await votingContract
            .deploy({ 
                data: '0x' + votingBytecode, 
                arguments: [deployedRewardToken.options.address] // Address of the RewardToken
            })
            .send({ 
                from: accounts[0], 
                gas: 4000000, 
                gasPrice: '30000000000' 
            });

        console.log('VotingAndRewards deployed at:', deployedVotingContract.options.address);

        // ===== SAVE DEPLOYMENT INFO =====
        const deploymentInfo = {
            rewardToken: {
                address: deployedRewardToken.options.address,
                deployer: accounts[0]
            },
            votingAndRewards: {
                address: deployedVotingContract.options.address,
                deployer: accounts[0]
            },
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
        console.log('\n=== Deployment Complete ===');
        console.log('Deployment info saved to deployment.json');
        
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

// Esegui la funzione di deploy
deployContracts();