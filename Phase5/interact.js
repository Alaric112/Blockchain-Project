const { Web3 } = require('web3');
const fs = require('fs');

// Connessione alla rete locale (Ganache)
const web3 = new Web3('HTTP://127.0.0.1:7545');

// Carica l'ABI del contratto
const abi = JSON.parse(fs.readFileSync('VotingAbi.json', 'utf8'));

// Indirizzo del contratto deployato (sostituisci con l'indirizzo reale dopo il deploy)
const contractAddress = '0xAc14C4C980E1c4F9719bC9cE22869C79cd165Ff4';                // <-- AGGIORNA QUESTO DOPO IL DEPLOY

async function testVotingContract() {
    try {
        console.log('🚀 Iniziando i test del contratto Voting...\n');

        // Recupera gli account disponibili
        const accounts = await web3.eth.getAccounts();
        console.log('📋 Account disponibili:', accounts.length);
        
        // Crea l'istanza del contratto
        const votingContract = new web3.eth.Contract(abi, contractAddress);

        // Test 1: Verifica il proprietario del contratto
        console.log('📝 Test 1: Verifica proprietario del contratto');
        const owner = await votingContract.methods.owner().call();
        console.log('   Owner:', owner);
        console.log('   Match con account[0]:', owner.toLowerCase() === accounts[0].toLowerCase() ? '✅' : '❌');
        console.log();

        // Test 2: Verifica l'indirizzo del contratto NFT
        console.log('📝 Test 2: Verifica indirizzo contratto NFT');
        const nftAddress = await votingContract.methods.proofOfPurchaseNFT().call();
        console.log('   Indirizzo NFT:', nftAddress);
        console.log();

        // Test 3: Vota su una review (upvote)
        console.log('📝 Test 3: Primo voto (upvote) su review ID 1');
        const reviewId = 1;
        
        const voteTx1 = await votingContract.methods.vote(reviewId, true).send({
            from: accounts[0],
            gas: 300000
        });
        
        console.log('   Transaction hash:', voteTx1.transactionHash);
        
        // Controlla il punteggio dopo il primo voto
        const scoreAfterFirstVote = await votingContract.methods.getReviewNetScore(reviewId).call();
        console.log('   Net score dopo primo voto:', scoreAfterFirstVote);
        console.log();

        // Test 4: Verifica il voto dell'utente
        console.log('📝 Test 4: Verifica voto utente');
        const myVote = await votingContract.methods.getMyVote(reviewId).call({ from: accounts[0] });
        console.log('   Il mio voto per review', reviewId + ':', myVote, '(1 = upvote, -1 = downvote, 0 = nessun voto)');
        console.log();

        // Test 5: Cambia voto (da upvote a downvote)
        console.log('📝 Test 5: Cambio voto (da upvote a downvote)');
        const voteTx2 = await votingContract.methods.vote(reviewId, false).send({
            from: accounts[0],
            gas: 300000
        });
        
        console.log('   Transaction hash:', voteTx2.transactionHash);
        
        const scoreAfterChangeVote = await votingContract.methods.getReviewNetScore(reviewId).call();
        console.log('   Net score dopo cambio voto:', scoreAfterChangeVote);
        console.log();

        // Test 6: Voto da un altro account
        console.log('📝 Test 6: Voto da altro account (upvote)');
        const voteTx3 = await votingContract.methods.vote(reviewId, true).send({
            from: accounts[1],
            gas: 300000
        });
        
        console.log('   Transaction hash:', voteTx3.transactionHash);
        
        const scoreAfterSecondUser = await votingContract.methods.getReviewNetScore(reviewId).call();
        console.log('   Net score dopo voto secondo utente:', scoreAfterSecondUser);
        console.log();

        // Test 7: Test su review diverse
        console.log('📝 Test 7: Voti su review diverse');
        
        // Voto su review ID 2
        await votingContract.methods.vote(2, true).send({
            from: accounts[0],
            gas: 300000
        });
        
        // Voto su review ID 3
        await votingContract.methods.vote(3, false).send({
            from: accounts[1],
            gas: 300000
        });
        
        const score2 = await votingContract.methods.getReviewNetScore(2).call();
        const score3 = await votingContract.methods.getReviewNetScore(3).call();
        
        console.log('   Review ID 2 net score:', score2);
        console.log('   Review ID 3 net score:', score3);
        console.log();

        // Test 8: Controlla eventi emessi
        console.log('📝 Test 8: Recupera eventi VoteCast');
        const events = await votingContract.getPastEvents('VoteCast', {
            fromBlock: 0,
            toBlock: 'latest'
        });
        
        console.log('   Numero totale di eventi VoteCast:', events.length);
        console.log('   Ultimi 3 eventi:');
        events.slice(-3).forEach((event, index) => {
            console.log(`   Evento ${index + 1}:`);
            console.log(`     Voter: ${event.returnValues.voter}`);
            console.log(`     Review ID: ${event.returnValues.reviewId}`);
            console.log(`     Vote Value: ${event.returnValues.voteValue}`);
            console.log(`     Weight: ${event.returnValues.weight}`);
            console.log(`     New Net Score: ${event.returnValues.newNetScore}`);
            console.log();
        });

        // Test 9: Summary finale
        console.log('📊 SUMMARY FINALE:');
        console.log('===================');
        for (let i = 1; i <= 3; i++) {
            const finalScore = await votingContract.methods.getReviewNetScore(i).call();
            console.log(`   Review ID ${i}: Net Score = ${finalScore}`);
        }
        
        console.log('\n✅ Tutti i test completati con successo!');

    } catch (error) {
        console.error('❌ Errore durante i test:', error);
    }
}

// Funzione per testare casi edge
async function testEdgeCases() {
    try {
        console.log('\n🧪 Test casi edge...\n');
        
        const accounts = await web3.eth.getAccounts();
        const votingContract = new web3.eth.Contract(abi, contractAddress);
        
        // Test: Verifica voto su review che non esiste ancora
        console.log('📝 Test Edge Case 1: Review inesistente');
        const nonExistentReviewId = 999;
        
        // Il voto dovrebbe funzionare anche per review "inesistenti"
        await votingContract.methods.vote(nonExistentReviewId, true).send({
            from: accounts[2],
            gas: 300000
        });
        
        const scoreNonExistent = await votingContract.methods.getReviewNetScore(nonExistentReviewId).call();
        console.log('   Score per review inesistente:', scoreNonExistent);
        
        // Test: Più cambi di voto consecutivi
        console.log('📝 Test Edge Case 2: Cambi di voto multipli');
        const testReviewId = 100;
        
        // Sequenza: upvote -> downvote -> upvote -> downvote
        await votingContract.methods.vote(testReviewId, true).send({ from: accounts[3], gas: 300000 });
        let score = await votingContract.methods.getReviewNetScore(testReviewId).call();
        console.log('   Dopo upvote:', score);
        
        await votingContract.methods.vote(testReviewId, false).send({ from: accounts[3], gas: 300000 });
        score = await votingContract.methods.getReviewNetScore(testReviewId).call();
        console.log('   Dopo cambio a downvote:', score);
        
        await votingContract.methods.vote(testReviewId, true).send({ from: accounts[3], gas: 300000 });
        score = await votingContract.methods.getReviewNetScore(testReviewId).call();
        console.log('   Dopo cambio a upvote:', score);
        
        console.log('\n✅ Test casi edge completati!');
        
    } catch (error) {
        console.error('❌ Errore nei test edge case:', error);
    }
}

// Funzione principale
async function main() {
    // Verifica che l'indirizzo del contratto sia stato impostato
    if (contractAddress === '0xYourContractAddressHere') {
        console.log('❌ ERRORE: Aggiorna l\'indirizzo del contratto in contractAddress prima di eseguire i test!');
        console.log('   Copia l\'indirizzo dal deploy.js dopo aver fatto il deploy.');
        return;
    }
    
    // Esegui i test principali
    await testVotingContract();
    
    // Esegui i test edge case
    await testEdgeCases();
}

// Esegui il main e cattura eventuali errori
main().catch(console.error);