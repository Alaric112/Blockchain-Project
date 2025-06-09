const { Web3 } = require('web3');
const fs = require('fs');

// Connessione alla rete locale
const web3 = new Web3('HTTP://127.0.0.1:7545');

async function interactWithContracts() {
    try {
        console.log('=== VOTING AND REWARDS CONTRACT INTERACTION TEST ===\n');
        
        // Recupera gli account
        const accounts = await web3.eth.getAccounts();
        console.log('Available accounts:', accounts.length);
        
        const admin = accounts[0];      // Admin del contratto
        const reviewer1 = accounts[1];  // Primo reviewer
        const reviewer2 = accounts[2];  // Secondo reviewer
        const voter1 = accounts[3];     // Primo voter (verified buyer)
        const voter2 = accounts[4];     // Secondo voter (non verified)
        const voter3 = accounts[5];     // Terzo voter (verified buyer)
        
        console.log('Admin:', admin);
        console.log('Reviewers:', reviewer1, reviewer2);
        console.log('Voters:', voter1, voter2, voter3);
        
        // Carica deployment info
        const deploymentInfo = JSON.parse(fs.readFileSync('deployment.json', 'utf8'));
        
        // Carica ABI
        const votingAbi = JSON.parse(fs.readFileSync('VotingAndRewardsAbi.json', 'utf8'));
        const rewardTokenAbi = JSON.parse(fs.readFileSync('RewardTokenAbi.json', 'utf8'));
        
        // Crea istanze dei contratti
        const votingContract = new web3.eth.Contract(votingAbi, deploymentInfo.votingAndRewards.address);
        const rewardTokenContract = new web3.eth.Contract(rewardTokenAbi, deploymentInfo.rewardToken.address);
        
        console.log('\nContracts loaded successfully!');
        console.log('VotingAndRewards:', deploymentInfo.votingAndRewards.address);
        console.log('RewardToken:', deploymentInfo.rewardToken.address);
        
        // === FASE 1: SETUP INIZIALE ===
        console.log('\n=== PHASE 1: INITIAL SETUP ===');
        
        // Verifica parametri iniziali
        const alpha = await votingContract.methods.alpha().call();
        const mu = await votingContract.methods.mu().call();
        const sigma = await votingContract.methods.sigma().call();
        const monthlyRewardPool = await votingContract.methods.monthlyRewardPool().call();
        const currentMonth = await votingContract.methods.currentMonth().call();
        
        console.log('Initial parameters:');
        console.log('- Alpha (visibility):', alpha);
        console.log('- Mu (peak month):', mu);
        console.log('- Sigma (spread):', sigma);
        console.log('- Monthly reward pool:', web3.utils.fromWei(monthlyRewardPool, 'ether'), 'tokens');
        console.log('- Current month:', currentMonth);
        
        // Imposta verified buyers
        console.log('\nSetting verified buyers...');
        await votingContract.methods.setVerifiedBuyer(voter1, true).send({ from: admin, gas: 100000 });
        await votingContract.methods.setVerifiedBuyer(voter3, true).send({ from: admin, gas: 100000 });
        
        console.log('✓ Voter1 and Voter3 set as verified buyers');
        
        // Verifica status
        const voter1Verified = await votingContract.methods.isVerifiedBuyer(voter1).call();
        const voter2Verified = await votingContract.methods.isVerifiedBuyer(voter2).call();
        const voter3Verified = await votingContract.methods.isVerifiedBuyer(voter3).call();
        
        console.log('Verification status:');
        console.log('- Voter1:', voter1Verified ? 'VERIFIED' : 'NOT VERIFIED');
        console.log('- Voter2:', voter2Verified ? 'VERIFIED' : 'NOT VERIFIED');
        console.log('- Voter3:', voter3Verified ? 'VERIFIED' : 'NOT VERIFIED');
        
        // === FASE 2: SUBMISSION DELLE REVIEW ===
        console.log('\n=== PHASE 2: REVIEW SUBMISSION ===');
        
        // Reviewer1 sottomette una review
        console.log('Reviewer1 submitting review...');
        await votingContract.methods.submitReview("Excellent product! Highly recommended for everyone.")
            .send({ from: reviewer1, gas: 300000 });
        
        // Reviewer2 sottomette una review
        console.log('Reviewer2 submitting review...');
        await votingContract.methods.submitReview("Good quality but could be improved in some aspects.")
            .send({ from: reviewer2, gas: 300000 });
        
        // Reviewer1 sottomette una seconda review
        console.log('Reviewer1 submitting second review...');
        await votingContract.methods.submitReview("Amazing customer service and fast delivery!")
            .send({ from: reviewer1, gas: 300000 });
        
        console.log('✓ Reviews submitted successfully');
        
        // Verifica le review
        const nextReviewId = await votingContract.methods.nextReviewId().call();
        console.log('Total reviews:', nextReviewId);
        
        for (let i = 0; i < nextReviewId; i++) {
            const review = await votingContract.methods.reviews(i).call();
            console.log(`\nReview ${i}:`);
            console.log('- Author:', review.author);
            console.log('- Content:', review.content);
            console.log('- Net Score:', review.netScore);
            console.log('- Revoked:', review.revoked);
        }
        
        // === FASE 3: VOTING ===
        console.log('\n=== PHASE 3: VOTING ===');
        
        // Voti per Review 0 (Reviewer1's first review)
        console.log('Voting on Review 0...');
        await votingContract.methods.voteReview(0, true).send({ from: voter1, gas: 150000 }); // +2 (verified)
        await votingContract.methods.voteReview(0, true).send({ from: voter2, gas: 150000 }); // +1 (not verified)
        await votingContract.methods.voteReview(0, false).send({ from: voter3, gas: 150000 }); // -2 (verified)
        
        // Voti per Review 1 (Reviewer2's review)
        console.log('Voting on Review 1...');
        await votingContract.methods.voteReview(1, true).send({ from: voter1, gas: 150000 }); // +2
        await votingContract.methods.voteReview(1, true).send({ from: voter3, gas: 150000 }); // +2
        
        // Voti per Review 2 (Reviewer1's second review)
        console.log('Voting on Review 2...');
        await votingContract.methods.voteReview(2, true).send({ from: voter1, gas: 150000 }); // +2
        await votingContract.methods.voteReview(2, true).send({ from: voter2, gas: 150000 }); // +1
        await votingContract.methods.voteReview(2, true).send({ from: voter3, gas: 150000 }); // +2
        
        console.log('✓ Voting completed');
        
        // Verifica i punteggi dopo il voto
        console.log('\n=== SCORES AFTER VOTING ===');
        for (let i = 0; i < nextReviewId; i++) {
            const review = await votingContract.methods.reviews(i).call();
            const visibilityScore = await votingContract.methods.getVisibilityScore(i).call();
            console.log(`Review ${i} - Net Score: ${review.netScore}, Visibility Score: ${visibilityScore}`);
        }
        
        // === FASE 4: TEST MODIFICA E REVOCA ===
        console.log('\n=== PHASE 4: MODIFY AND REVOKE TESTS ===');
        
        // Modifica Review 1
        console.log('Reviewer2 modifying review 1...');
        await votingContract.methods.modifyReview(1, "Updated: Good quality with recent improvements!")
            .send({ from: reviewer2, gas: 200000 });
        
        const modifiedReview = await votingContract.methods.reviews(1).call();
        console.log('Modified review content:', modifiedReview.content);
        console.log('Net score after modification:', modifiedReview.netScore); // Should be reset to 0
        
        // Revoca Review 2
        console.log('Reviewer1 revoking review 2...');
        await votingContract.methods.revokeReview(2).send({ from: reviewer1, gas: 100000 });
        
        const revokedReview = await votingContract.methods.reviews(2).call();
        console.log('Review 2 revoked status:', revokedReview.revoked);
        
        // === FASE 5: DISTRIBUZIONE REWARDS ===
        console.log('\n=== PHASE 5: REWARDS DISTRIBUTION ===');
        
        // Prima distribuzione
        console.log('Admin distributing rewards for month 1...');
        await votingContract.methods.distributeRewards().send({ from: admin, gas: 500000 });
        
        const newCurrentMonth = await votingContract.methods.currentMonth().call();
        console.log('Current month after distribution:', newCurrentMonth);
        
        // Verifica i token reward ricevuti
        console.log('\nToken balances after first distribution:');
        const reviewer1Balance = await rewardTokenContract.methods.balanceOf(reviewer1).call();
        const reviewer2Balance = await rewardTokenContract.methods.balanceOf(reviewer2).call();
        
        console.log('- Reviewer1:', web3.utils.fromWei(reviewer1Balance, 'ether'), 'tokens');
        console.log('- Reviewer2:', web3.utils.fromWei(reviewer2Balance, 'ether'), 'tokens');
        
        // Verifica reward per review
        console.log('\nRewards per review (month 1):');
        for (let i = 0; i < nextReviewId; i++) {
            const reward = await votingContract.methods.reviewRewards(i, 1).call();
            if (reward > 0) {
                console.log(`Review ${i}: ${web3.utils.fromWei(reward, 'ether')} tokens`);
            }
        }
        
        // === FASE 6: SECONDO CICLO (SIMULAZIONE AGING) ===
        console.log('\n=== PHASE 6: SECOND CYCLE (AGING SIMULATION) ===');
        
        // Nuova review nel mese 2
        console.log('Adding new review in month 2...');
        await votingContract.methods.submitReview("Fresh review with latest product updates!")
            .send({ from: reviewer2, gas: 300000 });
        
        // Voto sulla nuova review
        await votingContract.methods.voteReview(3, true).send({ from: voter1, gas: 150000 });
        await votingContract.methods.voteReview(3, true).send({ from: voter2, gas: 150000 });
        
        // Seconda distribuzione
        console.log('Admin distributing rewards for month 2...');
        await votingContract.methods.distributeRewards().send({ from: admin, gas: 500000 });
        
        // Verifica i nuovi bilanci
        console.log('\nFinal token balances:');
        const finalReviewer1Balance = await rewardTokenContract.methods.balanceOf(reviewer1).call();
        const finalReviewer2Balance = await rewardTokenContract.methods.balanceOf(reviewer2).call();
        
        console.log('- Reviewer1:', web3.utils.fromWei(finalReviewer1Balance, 'ether'), 'tokens');
        console.log('- Reviewer2:', web3.utils.fromWei(finalReviewer2Balance, 'ether'), 'tokens');
        
        // === FASE 7: TEST ERRORI ===
        console.log('\n=== PHASE 7: ERROR HANDLING TESTS ===');
        
        try {
            // Tentativo di voto duplicato
            await votingContract.methods.voteReview(0, true).send({ from: voter1, gas: 150000 });
            console.log('❌ ERROR: Duplicate vote should have failed');
        } catch (error) {
            console.log('✓ Duplicate vote correctly rejected:', error.message.includes('Same vote already cast'));
        }
        
        try {
            // Tentativo di modifica da parte di non-autore
            await votingContract.methods.modifyReview(0, "Unauthorized modification")
                .send({ from: reviewer2, gas: 200000 });
            console.log('❌ ERROR: Unauthorized modification should have failed');
        } catch (error) {
            console.log('✓ Unauthorized modification correctly rejected:', error.message.includes('Only author'));
        }
        
        try {
            // Tentativo di accesso admin da non-admin
            await votingContract.methods.setAlpha(20).send({ from: reviewer1, gas: 100000 });
            console.log('❌ ERROR: Non-admin access should have failed');
        } catch (error) {
            console.log('✓ Non-admin access correctly rejected:', error.message.includes('Only admin'));
        }
        
        // === FASE 8: VERIFICA FINALE ===
        console.log('\n=== PHASE 8: FINAL VERIFICATION ===');
        
        const finalCurrentMonth = await votingContract.methods.currentMonth().call();
        const finalNextReviewId = await votingContract.methods.nextReviewId().call();
        
        console.log('Final state:');
        console.log('- Current month:', finalCurrentMonth);
        console.log('- Total reviews created:', finalNextReviewId);
        
        // Verifica visibility scores finali
        console.log('\nFinal visibility scores:');
        for (let i = 0; i < finalNextReviewId; i++) {
            try {
                const review = await votingContract.methods.reviews(i).call();
                if (!review.revoked) {
                    const visibilityScore = await votingContract.methods.getVisibilityScore(i).call();
                    console.log(`Review ${i}: ${visibilityScore} (Net Score: ${review.netScore})`);
                } else {
                    console.log(`Review ${i}: REVOKED`);
                }
            } catch (error) {
                console.log(`Review ${i}: ERROR - ${error.message}`);
            }
        }
        
        // Verifica total supply del token
        const totalSupply = await rewardTokenContract.methods.totalSupply().call();
        console.log('\nReward Token total supply:', web3.utils.fromWei(totalSupply, 'ether'), 'tokens');
        
        console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Funzione helper per aspettare
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Esegui il test
interactWithContracts();