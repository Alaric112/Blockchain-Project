const { Web3 } = require('web3');
const fs = require('fs');

// Connect to Ganache
const web3 = new Web3('http://127.0.0.1:7545');

// Carichiamo l’ABI di MyTokenNFT (soulbound)
const abi = JSON.parse(fs.readFileSync('PurchaseAndMintAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
// Iserire qui gli indirizzi dei contratti deployati
const purchaseAddress = '0xaf6554ad5B8B757D5398c1Cb5B5973cAA19386BB'; // DA aggiornare
//const tokenAddress    = '0xf4674B01721764E716B568CF42A3E742e9128CeB';   // DA aggiornare

// Creiamo l’istanza del contratto
const contract = new web3.eth.Contract(abi, purchaseAddress);

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
    const orderId    = 17;
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
  
}

interactWithContract().catch(console.error);