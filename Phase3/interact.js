const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');        

// Connect to Ganache
const web3 = new Web3('http://127.0.0.1:7545');

// Carichiamo l’ABI di MyTokenNFT (soulbound)
const abi = JSON.parse(fs.readFileSync('PurchaseAndMintAbi.json', 'utf8'));
const tokenAbi = JSON.parse(fs.readFileSync("MyTokenNFTAbi.json", "utf8"));

// Set contract address (use the one from deployment)
// Iserire qui gli indirizzi dei contratti deployati
const tokenAddress    = '0x1756D78BAA2Caca5dD16bA9489EE23FdCbFdE455'; // <--------------- DA aggiornare
const purchaseAddress = '0x81BD67B3aEcB1CBC69E161cc830a1a07c5e99B6d'; // <--------------- DA aggiornare

// Creiamo l’istanza del contratto
const contract = new web3.eth.Contract(abi, purchaseAddress);
const nftContract = new web3.eth.Contract(tokenAbi, tokenAddress);

async function measure(label, txPromise) {
  const start = process.hrtime.bigint();
  const receipt = await txPromise;
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1e6;
  return {
    label,
    durationMs,
    gasUsed: Number(receipt.gasUsed)
  };
}

async function interactWithContract() {

    const results = [];  
    
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
    // Definizione dei parametri di test
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

    console.log('\n=== 0) Modifying admin of MyTokenNFT ===');
    try {
        await nftContract.methods.setAdmin(purchaseAddress).send({from: accounts[0]});

    } catch (err) {
        console.error('  ❌ Errore in setAdmin:', err.message);
        process.exit(1);

    }

    // ──────────────────────────────────────────────────────────────
    // registerOrder (merchant)
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 1) registerOrder da merchant ===');
    try {
        results.push(await measure(
            'registerOrder',
            contract.methods
            .registerOrder(orderId, shopDID, priceWei, expiration, commitment)
            .send({ from: merchant, gas: 500000 })
        ));
    } catch (err) {
        console.error('  ❌ Errore in registerOrder:', err.message);
        process.exit(1);
    }

    // ──────────────────────────────────────────────────────────────
    // 5) claimOrder (buyer)
    // ──────────────────────────────────────────────────────────────
    console.log('\n=== 2) claimOrder da buyer ===');

    results.push(await measure(
        'claimOrder (buyer)',
        contract.methods
        .claimOrder(orderId, orderSecret)
        .send({ from: buyer, value: priceWei, gas: 200000 })
    ));

    const balanceWei = await web3.eth.getBalance(purchaseAddress);
    console.log("💰 Saldo attuale contratto:", web3.utils.fromWei(balanceWei, 'ether'), "ETH");

    // ──────────────────────────────────────────────────────────────
    // 6) Tentativo di claim da un altro buyer (account 3)
    // ──────────────────────────────────────────────────────────────
    const maliciousBuyer = accounts[3];

    console.log('\n=== 3) claimOrder da un utente non autorizzato (should fail) ===');
    try {
        results.push(await measure(
        'claimOrder (malicious)',
        contract.methods
            .claimOrder(orderId, orderSecret)
            .send({ from: maliciousBuyer, value: priceWei, gas: 200000 })
        ));
        console.error('❌ Errore: la tx non autorizzata è passata');
    } catch (err) {
        console.log('✅ claimOrder bloccato correttamente');
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
        await measure(
        'merchantClaim #2 (too early)',
        contract.methods.merchantClaim(orderId2)
            .send({ from: merchant, gas: 200000 })
        );
        console.error('❌ merchantClaim precoce è passato (BUG)');
    } catch (err) {
        console.log('✅ merchantClaim #2 bloccato per finalità');
    }

    console.log('\n=== 5) Un utente non autorizzato prova a fare merchantClaim (should fail) ===');

    const attacker = accounts[4];

    try {
        await measure(
        'merchantClaim #2 (unauthorized)',
        contract.methods.merchantClaim(orderId2)
            .send({ from: attacker, gas: 200000 })
        );
        console.error('❌ merchantClaim non autorizzato è passato (BUG)');
    } catch (err) {
        console.log('✅ merchantClaim #2 bloccato per permessi');
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

    results.push(await measure(
        'merchantClaim #2 (success)',
        contract.methods.merchantClaim(orderId2)
        .send({ from: merchant, gas: 300000 })
    ));

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
    console.log("\n=== STAMPA RISULTATI ===");
    
    // Stampa misurazioni finale
    console.table(results, ['label', 'durationMs', 'gasUsed']);

    // Scegli un “base name” per i file
    const phaseName = 'Phase3';

    const outDir    = path.join(__dirname, '..', 'metrics');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    // --- JSONL: facciamo append, non overwrite
    const jsonlFile = path.join(outDir, `${phaseName}.jsonl`);
    // Append di una riga JSON+newline
    fs.appendFileSync(
        jsonlFile,
        JSON.stringify(
        results,
        (_, v) => typeof v === 'bigint' ? v.toString() : v
        ) + '\n'
    );
    console.log(`📊 Metrics JSONL appese in ${jsonlFile}`);

    // --- CSV: scriviamo l’header solo se il file non esiste, poi appendiamo le righe
    const csvFile = path.join(outDir, `${phaseName}.csv`);
    const header  = Object.keys(results[0]).join(',') + '\n';
    const csvBody = results
        .map(r => Object.values(r)
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
        ).join('\n') + '\n';

    if (!fs.existsSync(csvFile)) {
        // Prima run: creo e scrivo header+body
        fs.writeFileSync(csvFile, header + csvBody);
        console.log(`📊 Metrics CSV create in ${csvFile}`);
    } else {
        // Run successive: appendo solo il body
        fs.appendFileSync(csvFile, csvBody);
        console.log(`📊 Metrics CSV appese in  ${csvFile}`);
    }
    
}

interactWithContract().catch(console.error);