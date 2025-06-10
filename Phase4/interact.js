const {Web3} = require('web3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// 1) Configure Ganache and contract
const web3 = new Web3('HTTP://127.0.0.1:7545');
const contractAbi = JSON.parse(fs.readFileSync('IpfsStorageAbi.json', 'utf8'));

const contractAddress = '0xdDFDf8BA9B42e4092fecF1F0060D73b83b7DbD85';  // ← change here

const contract = new web3.eth.Contract(contractAbi, contractAddress);

    contract.events.StoredCID()
        .on('data', (ev) => {
        console.log(
            `[EVENT] Review registered → CID: ${ev.returnValues.cid}, shop: "${ev.returnValues.shop}"`
        );
        });

    contract.events.ReviewModified()
        .on('data', (ev) => {
        console.log(
            `[EVENT] Review modified → CID: ${ev.returnValues.cid}, shop: "${ev.returnValues.shop}"`
        );
        });

    contract.events.ReviewDeleted()
        .on('data', (ev) => {
        console.log(
            `[EVENT] Review deleted → CID: ${ev.returnValues.cid}"`
        );
        });   

// 2) File to upload
const filePath = path.join(__dirname, 'review.txt');

// ----- Direct upload function via HTTP POST -----
async function uploadToIPFS(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  const res = await axios.post('http://localhost:5001/api/v0/add', form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
  });
  let data = res.data;
  if (typeof data === 'string') {
    const lines = data.trim().split('\n');
    data = JSON.parse(lines[lines.length - 1]);
  }
  return data.Hash;
}

// ----- Direct download function via HTTP POST -----
async function downloadFromIPFS(cid, outputPath) {
  const res = await axios.post(
    'http://localhost:5001/api/v0/cat',
    null,
    {
      params: { arg: cid },
      responseType: 'stream',
    }
  );
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    res.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function interact() {
  try {
    const accounts = await web3.eth.getAccounts();
    const deployer = accounts[0];
    const merchant = accounts[1];
    const reviewer = accounts[2];

    console.log('\n──────────────────────────────────────────────────────────────');
    console.log(' PHASE 4 - TEST INTERACT IPFS & REVIEW');
    console.log('──────────────────────────────────────────────────────────────');
    console.log('Deployer  :', deployer);
    console.log('Merchant  :', merchant);
    console.log('Reviewer  :', reviewer);

    // 1. Upload IPFS
    console.log('\n=== 1) Upload review.txt su IPFS ===');
    const cid = await uploadToIPFS(filePath);
    console.log('  → CID ottenuto:', cid);

    // 2. Salva CID su blockchain
    console.log('\n=== 2) Salva CID su blockchain ===');
    try {
      await contract.methods.storeCID(1, reviewer, merchant, cid).send({ from: deployer, gas: 300000 });
      console.log('  → CID salvato on-chain.');
    } catch (err) {
      console.error('  ❌ Errore nel salvataggio CID:', err.message);
      process.exit(1);
    }

    // 3. Recupera CID da blockchain
    console.log('\n=== 3) Recupera CID da blockchain ===');
    let retrievedCID;
    try {
      retrievedCID = await contract.methods.getCID(1).call();
      console.log('  → CID recuperato:', retrievedCID);
    } catch (err) {
      console.error('  ❌ Errore nel recupero CID:', err.message);
      process.exit(1);
    }

    // 4. Scarica file da IPFS
    const outputPath = path.join(__dirname, 'fromipfs.txt');
    console.log('\n=== 4) Download review.txt da IPFS ===');
    await downloadFromIPFS(retrievedCID, outputPath);
    console.log('  → File scaricato in:', outputPath);

    // 5. Modifica la review
    const new_filePath = path.join(__dirname, 'modifiedreview.txt');
    console.log('\n=== 5) Upload modifiedreview.txt su IPFS ===');
    const new_cid = await uploadToIPFS(new_filePath);
    console.log('  → Nuovo CID ottenuto:', new_cid);

    console.log('\n=== 6) Modifica review on-chain ===');
    try {
      await contract.methods.modifyReview(1, new_cid).send({ from: reviewer, gas: 300000 });
      console.log('  → Review modificata con successo.');
    } catch (err) {
      console.error('  ❌ Errore nella modifica review:', err.message);
      process.exit(1);
    }

    // 7. Recupera il nuovo CID da blockchain
    console.log('\n=== 7) Recupera nuovo CID da blockchain ===');
    try {
      retrievedCID = await contract.methods.getCID(1).call();
      console.log('  → Nuovo CID recuperato:', retrievedCID);
    } catch (err) {
      console.error('  ❌ Errore nel recupero nuovo CID:', err.message);
      process.exit(1);
    }

    // 8. Scarica la review modificata da IPFS
    const new_outputPath = path.join(__dirname, 'modifiedfromipfs.txt');
    console.log('\n=== 8) Download modifiedreview.txt da IPFS ===');
    await downloadFromIPFS(retrievedCID, new_outputPath);
    console.log('  → File scaricato in:', new_outputPath);

    // 9. Elimina la review
    console.log('\n=== 9) Elimina review ===');
    try {
      await contract.methods.deleteReview(1).send({ from: reviewer, gas: 300000 });
      console.log('  → Review eliminata con successo.');
      retrievedCID = await contract.methods.getCID(1).call();
      console.log('  → CID dopo eliminazione:', retrievedCID);
    } catch (err) {
      console.error('  ❌ Errore nell\'eliminazione review:', err.message);
      process.exit(1);
    }

    console.log('\n=== TEST COMPLETATO ===\n');

  } catch (err) {
    console.error('Errore durante l\'esecuzione:', err);
  }
}

interact();