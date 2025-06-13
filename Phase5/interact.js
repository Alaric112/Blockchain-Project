// interact.js
// Script per testare il contratto VotingAndRewards.sol
// Esegue il setup di utenti, pubblicazione e votazione di recensioni, e distribuzione ricompense.

// Import delle librerie
const { Web3 } = require('web3');
const fs = require('fs');

// Connessione a Ganache (RPC locale)
const web3 = new Web3('http://127.0.0.1:7545');

// Carichiamo gli ABI dei contratti (assicurarsi di compilare e generare gli ABI prima)
const votingAbi = JSON.parse(fs.readFileSync('VotingAndRewardsAbi.json', 'utf8'));
const rewardTokenAbi = JSON.parse(fs.readFileSync('RewardTokenAbi.json', 'utf8'));

// Indirizzi dei contratti deployati (sostituire con gli indirizzi effettivi dopo il deploy)
const rewardTokenAddress = '0xb6C3B41288DC372D847ac491B41cE558fBc328c3';   // <--- DA AGGIORNARE
const votingAddress = '0xf441fF50AD4e4Cc9840D89bD401E64dC4b6b56c4';        // <--- DA AGGIORNARE

// Creiamo le istanze dei contratti
const votingContract = new web3.eth.Contract(votingAbi, votingAddress);
const rewardTokenContract = new web3.eth.Contract(rewardTokenAbi, rewardTokenAddress);

async function measure(label, txPromise) {
  const start = process.hrtime.bigint();
  const receipt = await txPromise;
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1e6;
  return {
    label,
    durationMs,
    gasUsed: receipt.gasUsed
  };
}


async function interactWithVotingContract() {

    const results = [];

    // Otteniamo gli account da Ganache
    const accounts = await web3.eth.getAccounts();

    // Assegniamo ruoli semplificati
    const admin = accounts[0];
    const reviewer1 = accounts[1];
    const reviewer2 = accounts[2];
    const voter1 = accounts[3];
    const voter2 = accounts[4];
    const voter3 = accounts[5];

    // Ascoltatori di eventi per il contratto di voto
    votingContract.events.ReviewSubmitted()
        .on('data', (ev) => {
            console.log(`[EVENT] ReviewSubmitted → reviewId: ${ev.returnValues.reviewId}, author: ${ev.returnValues.author}`);
        });
    votingContract.events.Voted()
        .on('data', (ev) => {
            console.log(`[EVENT] Voted → reviewId: ${ev.returnValues.reviewId}, voter: ${ev.returnValues.voter}, weight: ${ev.returnValues.voteWeight}`);
        });
    votingContract.events.RewardsDistributed()
        .on('data', (ev) => {
            console.log(`[EVENT] RewardsDistributed → month: ${ev.returnValues.month}`);
        });
    votingContract.events.ReviewRevoked()
        .on('data', (ev) => {
            console.log(`[EVENT] ReviewRevoked → reviewId: ${ev.returnValues.reviewId}`);
        });
    votingContract.events.ReviewModified()
        .on('data', (ev) => {
            console.log(`[EVENT] ReviewModified → reviewId: ${ev.returnValues.reviewId}`);
        });

    console.log('\n=== SETUP INIZIALE ===');
    const currentAdmin = await votingContract.methods.admin().call();
    console.log(`👤 Admin corrente: ${currentAdmin}`);

    // 1) Settaggio Verified Buyers (voto pesato)
    console.log('\n=== 1) Settaggio Verified Buyers ===');


    await results.push(await measure(
            'setVerifiedBuyer', votingContract.methods.setVerifiedBuyer(voter1, true).send({ from: admin, gas: 100000 })
            
        ));
    
    console.log(`✅ ${voter1} settato come verified buyer`);
    await votingContract.methods.setVerifiedBuyer(voter2, true).send({ from: admin, gas: 100000 });
    console.log(`✅ ${voter2} settato come verified buyer`);
    // voter3 rimane NON verified

    // 2) Submission di alcune review
    console.log('\n=== 2) Submission di Review ===');

    
    await results.push(await measure(
            'submitReview', votingContract.methods.submitReview("Ottimo prodotto, lo consiglio vivamente!").send({ from: reviewer1, gas: 1000000 })
            
        ));


    console.log('✅ Review #0 submessa da reviewer1');
    await votingContract.methods.submitReview("Prodotto discreto, nulla di eccezionale").send({ from: reviewer2, gas: 1000000 });
    console.log('✅ Review #1 submessa da reviewer2');
    await votingContract.methods.submitReview("Pessima esperienza, non lo ricomprerei mai").send({ from: reviewer1, gas: 1000000 });
    console.log('✅ Review #2 submessa da reviewer1');

    // 3) Voting delle review
    console.log('\n=== 3) Voting delle Review ===');
    // Review #0: voti positivi da verified buyers

    await results.push(await measure(
            'voteReview', votingContract.methods.voteReview(0, true).send({ from: voter1, gas: 150000 })
        ));
    
    console.log('✅ voter1 (verified) ha votato upvote per review #0');
    await votingContract.methods.voteReview(0, true).send({ from: voter2, gas: 150000 });
    console.log('✅ voter2 (verified) ha votato upvote per review #0');
    await votingContract.methods.voteReview(0, true).send({ from: voter3, gas: 150000 });
    console.log('✅ voter3 (non-verified) ha votato upvote per review #0');

    // Review #1: voti misti
    await votingContract.methods.voteReview(1, true).send({ from: voter1, gas: 150000 });
    console.log('✅ voter1 (verified) ha votato upvote per review #1');
    await votingContract.methods.voteReview(1, false).send({ from: voter2, gas: 150000 });
    console.log('✅ voter2 (verified) ha votato downvote per review #1');

    // Review #2: voti negativi
    await votingContract.methods.voteReview(2, false).send({ from: voter1, gas: 150000 });
    console.log('✅ voter1 (verified) ha votato downvote per review #2');
    await votingContract.methods.voteReview(2, false).send({ from: voter3, gas: 150000 });
    console.log('✅ voter3 (non-verified) ha votato downvote per review #2');

    // 4) Verifica dei net scores e contenuti
    console.log('\n=== 4) Verifica Net Scores ===');
    for (let i = 0; i < 3; i++) {
        const review = await votingContract.methods.reviews(i).call();
        console.log(`📊 Review #${i} - NetScore: ${review.netScore}, Author: ${review.author}`);
        console.log(`   Content: "${review.content}"`);
        const visibilityScore = await votingContract.methods.getVisibilityScore(i).call();
        console.log(`   Visibility Score: ${web3.utils.fromWei(visibilityScore, 'ether')}`);
    }

    // 5) Test voto doppio (dovrebbe fallire)
    console.log('\n=== 5) Test Voto Doppio (should fail) ===');
    try {

        await results.push(await measure(
            'voteReview',votingContract.methods.voteReview(0, true).send({ from: voter1, gas: 150000 })
        ));console.error("❌ ERRORE: Voto doppio accettato (BUG)");
    } catch (err) {
        console.log("✅ Voto doppio correttamente rifiutato:", err.message);
    }

    // 6) Test modifica review
    console.log('\n=== 6) Test Modifica Review ===');
    console.log('📝 Review #1 prima della modifica:');
    let reviewBefore = await votingContract.methods.reviews(1).call();
    console.log(`   NetScore: ${reviewBefore.netScore}`);
    console.log(`   Content: "${reviewBefore.content}"`);


    await results.push(await measure(
            'modifyReview', votingContract.methods.modifyReview(1, "Ho rivisto la mia opinione: il prodotto è fantastico!").send({
        from: reviewer2,
        gas: 1000000
    })
        ));

    console.log('✅ Review #1 modificata da reviewer2');
    console.log('📝 Review #1 dopo la modifica:');
    let reviewAfter = await votingContract.methods.reviews(1).call();
    console.log(`   NetScore: ${reviewAfter.netScore} (dovrebbe essere 0 - reset)`);
    console.log(`   Content: "${reviewAfter.content}"`);

    // 7) Test modifica non autorizzata (dovrebbe fallire)
    console.log('\n=== 7) Test Modifica Non Autorizzata (should fail) ===');
    try {
        await results.push(await measure( // misura del tempo di esecuzione e gas utilizzato
            'modifyReview',
            votingContract.methods.modifyReview(0, "Tentativo di hack").send({ from: voter1, gas: 1000000 })
        ));
        
        console.error("❌ ERRORE: Modifica non autorizzata accettata (BUG)");
    } catch (err) {
        console.log("✅ Modifica non autorizzata correttamente rifiutata:", err.message);
    }

    // 8) Test revoca review
    console.log('\n=== 8) Test Revoca Review ===');

    
    await results.push(await measure( // misura del tempo di esecuzione e gas utilizzato
            'revokeReview',
            votingContract.methods.revokeReview(2).send({ from: reviewer1, gas: 150000 })
        ));
    
    console.log('✅ Review #2 revocata da reviewer1');
    const revokedReview = await votingContract.methods.reviews(2).call();
    console.log(`📊 Review #2 - Revoked: ${revokedReview.revoked}`);
    // Voto su review revocata (dovrebbe fallire)
    console.log('\n=== 9) Test Voto su Review Revocata (should fail) ===');
    try {
        await votingContract.methods.voteReview(2, true).send({ from: voter2, gas: 150000 });
        console.error("❌ ERRORE: Voto su review revocata accettato (BUG)");
    } catch (err) {
        console.log("✅ Voto su review revocata correttamente rifiutato:", err.message);
    }

    // 10) Aggiungiamo più review per test ricompense
    console.log('\n=== 10) Aggiunta Review per Test Rewards ===');
    await votingContract.methods.submitReview("Review di alta qualità con molti dettagli").send({ from: reviewer2, gas: 1500000 });
    console.log('✅ Review #3 submessa da reviewer2');
    // Voti positivi a review #3


    await results.push(await measure(
            'voteReview', votingContract.methods.voteReview(3, true).send({ from: voter1, gas: 150000 })
        ));

    await votingContract.methods.voteReview(3, true).send({ from: voter2, gas: 150000 });
    await votingContract.methods.voteReview(3, true).send({ from: voter3, gas: 150000 });

    // Forniamo token di ricompensa al contratto VotingAndRewards
    await results.push(await measure(
            'transfer', rewardTokenContract.methods.transfer(votingAddress, web3.utils.toWei('1000', 'ether')).send({
        from: admin,
        gas: 100000
    })
        ));
    console.log('✅ Trasferiti 1000 RWT al contratto VotingAndRewards');

    // 11) Distribuzione ricompense
    console.log('\n=== 11) Distribuzione Rewards ===');
    console.log('💰 Balance iniziali RewardToken:');
    for (let i = 1; i <= 2; i++) {
        const balance = await rewardTokenContract.methods.balanceOf(accounts[i]).call();
        console.log(`   Account ${i} (${accounts[i]}): ${web3.utils.fromWei(balance, 'ether')} RWT`);
    }
    const poolBalance = await rewardTokenContract.methods.balanceOf(votingAddress).call();
    console.log(`💰 VotingAndRewards balanceOf: ${web3.utils.fromWei(poolBalance, 'ether')} RWT`);
    for (let i = 0; i < 4; i++) {
        const review = await votingContract.methods.reviews(i).call();
        console.log(`📊 Review #${i} → revoked=${review.revoked}, netScore=${review.netScore}, author=${review.author}`);
    }

    const currentMonth = await votingContract.methods.currentMonth().call();
    console.log(`📅 Mese corrente prima della distribuzione: ${currentMonth}`);

    await votingContract.methods.distributeRewards().send({ from: admin, gas: 500000 });
    console.log('✅ Distribuzione rewards completata');

    console.log('💰 Balance finali RewardToken:');
    const decimals = await rewardTokenContract.methods.decimals().call();
    const decimalsFactor = BigInt(10) ** BigInt(decimals);
    for (let i = 1; i <= 2; i++) {
        const balance = await rewardTokenContract.methods.balanceOf(accounts[i]).call();
        const adjustedBalance = Number(BigInt(balance) / decimalsFactor);
        console.log(`   Account ${i}: ${adjustedBalance} RWT`);
    }

    // 12) Verifica ricompense specifiche per recensione
    console.log('\n=== 12) Verifica Rewards Specifici ===');
    for (let reviewId = 0; reviewId < 4; reviewId++) {
        try {
            const reward = await votingContract.methods.reviewRewards(reviewId, currentMonth).call();
            if (reward > 0) {
                console.log(`🎁 Review #${reviewId} ha ricevuto: ${web3.utils.fromWei(reward, 'ether')} RWT`);
            }
        } catch (err) {
            // La review potrebbe non esistere o essere revocata
        }
    }

    // 13) Test modifica parametri admin
    console.log('\n=== 13) Test Modifica Parametri Admin ===');
    const alphaBefore = await votingContract.methods.alpha().call();
    console.log(`📊 Alpha prima: ${alphaBefore}`);

    
    

    await await results.push(await measure(
            'setAlpha', votingContract.methods.setAlpha(15).send({ from: admin, gas: 100000 })
        ));
    
    console.log('✅ Alpha modificato a 15');
    const alphaAfter = await votingContract.methods.alpha().call();
    console.log(`📊 Alpha dopo: ${alphaAfter}`);
    console.log('\n=== 14) Test Modifica Parametri Non Autorizzata (should fail) ===');
    try {
        await votingContract.methods.setMu(5).send({ from: voter1, gas: 100000 });
        console.error("❌ ERRORE: Modifica parametri non autorizzata accettata (BUG)");
    } catch (err) {
        console.log("✅ Modifica parametri non autorizzata correttamente rifiutata:", err.message);
    }

    // 15) Test funzione di peso gaussiano
    console.log('\n=== 15) Test Gaussian Weight Function ===');
    const mu = await votingContract.methods.mu().call();
    console.log(`📊 Mu (mese di picco): ${mu}`);
    for (let j = 0; j <= 5; j++) {
        const weight = await votingContract.methods.gaussianWeight(j).call();
        console.log(`   gaussianWeight(${j}): ${web3.utils.fromWei(weight, 'ether')}`);
    }

    // 16) Seconda distribuzione (mese successivo)
    console.log('\n=== 16) Seconda Distribuzione Rewards ===');
    // Aggiungiamo una nuova review nel secondo mese
    await votingContract.methods.submitReview("Review del secondo mese").send({ from: reviewer1, gas: 1000000 });
    await votingContract.methods.voteReview(4, true).send({ from: voter1, gas: 150000 });
    // Trasferiamo altri token e distribuiamo di nuovo
    await rewardTokenContract.methods.transfer(votingAddress, web3.utils.toWei('1000', 'ether')).send({ from: admin, gas: 100000 });
    console.log('✅ Trasferiti 1000 RWT al contratto VotingAndRewards (secondo mese)');
    await votingContract.methods.distributeRewards().send({ from: admin, gas: 500000 });
    console.log('✅ Seconda distribuzione rewards completata');
    const currentMonth2 = await votingContract.methods.currentMonth().call();
    console.log(`📅 Mese corrente dopo seconda distribuzione: ${currentMonth2}`);
    console.log('\n💰 Balance finali dopo seconda distribuzione:');
    for (let i = 1; i <= 2; i++) {
        const balance = await rewardTokenContract.methods.balanceOf(accounts[i]).call();
        const adjustedBalance = Number(BigInt(balance) / decimalsFactor);
        console.log(`   Account ${i}: ${adjustedBalance} RWT`);
    }

    console.log("\n=== TEST COMPLETATO ===");

    // Stampa misurazioni finale
    console.table(results, ['label', 'durationMs', 'gasUsed']);

}

// Esegue la funzione principale (gestisce errori)
interactWithVotingContract().catch(console.error);


