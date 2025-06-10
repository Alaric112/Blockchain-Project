const { Web3 } = require('web3');
const fs = require('fs');

// Connect to Ganache
const web3 = new Web3('http://127.0.0.1:7545');

// Carichiamo l’ABI di MyTokenNFT (soulbound)
const abi = JSON.parse(fs.readFileSync('PurchaseAndMintAbi.json', 'utf8'));
const tokenAbi = JSON.parse(fs.readFileSync("MyTokenNFTAbi.json", "utf8"));

// Set contract address (use the one from deployment)
// Iserire qui gli indirizzi dei contratti deployati
const tokenAddress    = '0x8738EB3aBbcfCb926B91d461506d71381054a941'; // <--------------- DA aggiornare
const purchaseAddress = '0x89dEB76339Fe9ee80f7EF17e8bA0a9bAe46a58b9'; // <--------------- DA aggiornare

// Creiamo l’istanza del contratto
const contract = new web3.eth.Contract(abi, purchaseAddress);
const nftContract = new web3.eth.Contract(tokenAbi, tokenAddress);

async function interactWithContract() {

    // Preleviamo gli account offerti da Ganache
    const accounts = await web3.eth.getAccounts();

    // Per semplicità: merchant = account1, buyer = account2
    const merchant = accounts[1];
    const buyer    = accounts[2];

    contract.events.OrderRegistered()
        .on('data', (ev) => {
        console.log(
            `[EVENT] OrderRegistered → orderId: ${ev.returnValues.orderId}, shopDID: "${ev.returnValues.shopDID}", price: ${ev.returnValues.price}`
        );
        });

    contract.events.OrderClaimed()
        .on('data', (ev) => {
        console.log(
            `[EVENT] OrderClaimed → orderId: ${ev.returnValues.orderId}, buyer: ${ev.returnValues.buyer}, cost: ${ev.returnValues.cost}`
        );
        });

    contract.events.OrderSettled()
        .on('data', (ev) => {
        console.log(
            `[EVENT] OrderSettled → orderId: ${ev.returnValues.orderId}`
        );
        });

    // ──────────────────────────────────────────────────────────────
    // 3) Definizione dei parametri di test
    // ──────────────────────────────────────────────────────────────
    const orderId    = 1;
    const shopDID    = 'did:shop:XYZ';
    const priceEth   = '0.1';
    const priceWei   = web3.utils.toWei(priceEth, 'ether'); // 1 ETH
    const nowSec     = Math.floor(Date.now() / 1000);
    const lifetime   = 3600; // 1 ora
    const expiration = nowSec + lifetime;    

    // L’orderSecret in formato bytes32
    const orderSecret = web3.utils.padRight(
        web3.utils.asciiToHex('super_secret'),
        64
    );
    // Commitment = keccak256(orderId, orderSecret)
    const commitment = web3.utils.soliditySha3(
        { t: 'uint256', v: orderId },
        { t: 'bytes32', v: orderSecret }
    );

    console.log('\nParametri ordine:');
    console.log('  orderId     =', orderId);
    console.log('  shopDID     =', shopDID);
    console.log('  priceWei    =', priceWei);
    console.log('  expiration  =', expiration);
    console.log('  orderSecret =', orderSecret);
    console.log('  commitment  =', commitment);

    // ──────────────────────────────────────────────────────────────
    // 4) registerOrder (merchant)
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 1) registerOrder da merchant ===');
    try {
        const txReg = await contract.methods
        .registerOrder(orderId, shopDID, priceWei, expiration, commitment)
        .send({ from: merchant, gas: 500000 });
        console.log('  → registerOrder txHash:', txReg.transactionHash);
    } catch (err) {
        console.error('  ❌ Errore in registerOrder:', err.message);
        process.exit(1);
    }

    // ──────────────────────────────────────────────────────────────
    // 5) claimOrder (buyer)
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 2) claimOrder da buyer ===');

    await contract.methods.claimOrder(orderId, orderSecret).send({
    from: buyer,
    value: priceWei,
    gas: 200000,               // Aggiungi un gas limit generoso (ad es. 300,000)
    });

    const balanceWei = await web3.eth.getBalance(purchaseAddress);
    console.log("💰 Saldo attuale contratto:", web3.utils.fromWei(balanceWei, 'ether'), "ETH");

    // ──────────────────────────────────────────────────────────────
    // 6) Tentativo di claim da un altro buyer (account 3)
    // ──────────────────────────────────────────────────────────────
    const maliciousBuyer = accounts[3];

    console.log('\n=== 3) claimOrder da un utente non autorizzato (should fail) ===');
    try {
        await contract.methods.claimOrder(orderId, orderSecret).send({
            from: maliciousBuyer,
            value: priceWei,
            gas: 200000,
        });
        console.error("❌ ERRORE: Il secondo claimOrder è stato accettato (BUG)");
    } catch (err) {
        console.log("✅ Il secondo claim è stato correttamente rifiutato:", err.message);
    }    

    // ──────────────────────────────────────────────────────────────
    // Definizione nuovo ordine
    // ──────────────────────────────────────────────────────────────
    const orderId2    = orderId+1;
    const shopDID2    = 'did:shop:XYZ';
    const priceEth2   = '0.1';
    const priceWei2   = web3.utils.toWei(priceEth2, 'ether'); // 1 ETH
    const nowSec2     = Math.floor(Date.now() / 1000);
    const lifetime2   = 3600; // 1 ora
    const expiration2 = nowSec2 + lifetime2;
    
    // L’orderSecret in formato bytes32
    const orderSecret2 = web3.utils.padRight(
        web3.utils.asciiToHex('super_secret'),
        64
    );
    // Commitment = keccak256(orderId, orderSecret)
    const commitment2 = web3.utils.soliditySha3(
        { t: 'uint256', v: orderId2 },
        { t: 'bytes32', v: orderSecret2 }
    );

    // ──────────────────────────────────────────────────────────────
    // registerOrder (merchant)
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 1) registerOrder da merchant ===');
    try {
        const txReg = await contract.methods
        .registerOrder(orderId2, shopDID2, priceWei2, expiration2, commitment2)
        .send({ from: merchant, gas: 500000 });
        console.log('  → registerOrder txHash:', txReg.transactionHash);
    } catch (err) {
        console.error('  ❌ Errore in registerOrder:', err.message);
        process.exit(1);
    }    

    // L’orderSecret in formato bytes32
    const orderSecretFake = web3.utils.padRight(
        web3.utils.asciiToHex('fake_secret'),
        64
    );
    // Commitment = keccak256(orderId, orderSecret)
    const commitmentFake = web3.utils.soliditySha3(
        { t: 'uint256', v: orderId2 },
        { t: 'bytes32', v: orderSecretFake }
    );

    // ──────────────────────────────────────────────────────────────
    //  Tentativo di claim da un altro buyer (account 3)
    // ──────────────────────────────────────────────────────────────    
    console.log('\n=== 3) claimOrder da un utente non autorizzato (should fail) ===');
    try {
        await contract.methods.claimOrder(orderId2, orderSecretFake).send({
            from: maliciousBuyer,
            value: priceWei2,
            gas: 200000,
        });
        console.error("❌ ERRORE: Il secondo claimOrder è stato accettato (BUG)");
    } catch (err) {
        console.log("✅ Il secondo claim è stato correttamente rifiutato in quanto non possiede l'order secret del buyer originale:", err.message);
    }    

    // ──────────────────────────────────────────────────────────────
    // claimOrder (buyer)
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 2) claimOrder da buyer ===');

    await contract.methods.claimOrder(orderId2, orderSecret2).send({
    from: buyer,
    value: priceWei2,
    gas: 200000,               // Aggiungi un gas limit generoso (ad es. 300,000)
    });

    const balanceWei2 = await web3.eth.getBalance(purchaseAddress);
    console.log("💰 Saldo attuale contratto:", web3.utils.fromWei(balanceWei2, 'ether'), "ETH");

    console.log('\n=== 4) Il merchant tenta di fare merchantClaim troppo presto (should fail) ===');

    try {
        await contract.methods.merchantClaim(orderId2).send({
            from: merchant,
            gas: 200000,
        });
        console.error("❌ ERRORE: merchantClaim è riuscita troppo presto (BUG)");
    } catch (err) {
        console.log("✅ Corretta protezione contro merchantClaim precoce:", err.message);
    }

    console.log('\n=== 5) Un utente non autorizzato prova a fare merchantClaim (should fail) ===');

    const attacker = accounts[4];

    try {
        await contract.methods.merchantClaim(orderId2).send({
            from: attacker,
            gas: 200000,
        });
        console.error("❌ ERRORE: merchantClaim accettata da utente non autorizzato (BUG)");
    } catch (err) {
        console.log("✅ merchantClaim bloccata per utente non autorizzato:", err.message);
    }

    console.log('\n🔁 Inviamo 5 TX dummy per avanzare blocchi...');
    for (let i = 0; i < 5; i++) {
        await web3.eth.sendTransaction({
            from: accounts[6],
            to: accounts[7],
            value: '1', // 1 wei
            gas: 21000
        });
    }

    console.log('\n=== 6) Il merchant riprova merchantClaim dopo 5 blocchi ===');

    const merchantBalanceBefore = await web3.eth.getBalance(merchant);

    try {
        const tx = await contract.methods.merchantClaim(orderId2).send({
            from: merchant,
            gas: 300000,
        });
        console.log("✅ merchantClaim riuscita, txHash:", tx.transactionHash);
    } catch (err) {
        console.error("❌ merchantClaim fallita (BUG):", err.message);
    }

    const merchantBalanceAfter = await web3.eth.getBalance(merchant);

    const delta = web3.utils.fromWei((BigInt(merchantBalanceAfter) - BigInt(merchantBalanceBefore)).toString(), 'ether');
    console.log("💸 Il merchant ha ricevuto:", delta, "ETH");

    const merchantBalanceWei = await web3.eth.getBalance(merchant);
    const merchantBalanceEth = web3.utils.fromWei(merchantBalanceWei, 'ether');
    console.log(`Saldo totale merchant (${merchant}): ${merchantBalanceEth} ETH`);

    // ──────────────────────────────────────────────────────────────
    // Verifichiamo che il buyer abbia ricevuto il suo NFT “proof-of-purchase”
    // ──────────────────────────────────────────────────────────────

    // Controlla se esiste un NFT
    const exists = await nftContract.methods.exists(1).call();
    console.log(`\n🔍 NFT.exists(${1}) =`, exists);

    if (exists) {
      // Verifica il proprietario
      const owner = await nftContract.methods.ownerOf(1).call();
      console.log(`🔍 NFT.ownerOf(${1}) =`, owner);
    }

    // Controlla quanti NFT possiede il buyer
    const balanceBuyer = await nftContract.methods.balanceOf(buyer).call();
    console.log(
      `🔍 NFT.balanceOf(buyer = ${buyer}) =`,
      balanceBuyer,
      "tokeni"
    );

    console.log("\n=== TEST COMPLETATO ===");

}

interactWithContract().catch(console.error);