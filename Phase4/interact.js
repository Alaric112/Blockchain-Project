const {Web3} = require('web3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// 1) Configure Ganache and contract
const web3 = new Web3('HTTP://127.0.0.1:7545');
const contractAbi = JSON.parse(fs.readFileSync('IpfsStorageAbi.json', 'utf8'));

const contractAddress = '0x72cE70637bcC8963254D5d6f8719534E7caE52fB';  // ← change here

const contract = new web3.eth.Contract(contractAbi, contractAddress);

    contract.events.StoredCID()
        .on('data', (ev) => {
        console.log(
            `[EVENT] Review registered → CID: ${ev.returnValues.cid}, shop: "${ev.returnValues.shop}"`
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

// ----- Main -----
async function interact() {
  try {
    const accounts = await web3.eth.getAccounts();
    
    // Per semplicità: merchant = account1, buyer = account2
    const deployer = accounts[0];
    const merchant = accounts[1];
    const reviewer    = accounts[2];
    console.log('Merchant account:', merchant);
    console.log('Buyer account:', reviewer);



    // 1. Upload IPFS
    console.log(' Uploading to IPFS…');
    const cid = await uploadToIPFS(filePath);
    console.log(' CID obtained:', cid);

    // 2. Salva CID su blockchain
    console.log(' Saving CID on blockchain...');
    try {
    await contract.methods.storeCID(1, reviewer, merchant, cid).send({ from: deployer, gas: 300000 });
    console.log(' CID saved on-chain.');
    } catch (err) {
      console.error('  ❌ Error saving CID on blockchain:', err);
      process.exit(1);
    }

    // 3. Recupera CID da blockchain
    console.log(' Retrieving CID from blockchain...');
    let retrievedCID;
    try {
    retrievedCID = await contract.methods.getCID(1).call();
    console.log(' CID retrieved:', retrievedCID);
    } catch (err) {
      console.error('  ❌ Error retrieving CID from blockchain:', err.message);
      process.exit(1);
    }

    // 4. Scarica file da IPFS
    const outputPath = path.join(__dirname, 'fromipfs.txt');
    console.log(' Downloading from IPFS…');
    await downloadFromIPFS(retrievedCID, outputPath);
    console.log(' File downloaded to:', outputPath);

  } catch (err) {
    console.error('Errore durante l\'esecuzione:', err);
  }
}

interact();