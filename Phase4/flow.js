const {Web3} = require('web3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// 1) Configure Ganache and contract
const web3 = new Web3('HTTP://127.0.0.1:7545');
const contractAbi = JSON.parse(fs.readFileSync('IpfsStorageAbi.json', 'utf8'));
const contractAddress = '0xCE40CB5D64549B96A2c840c973f2dE4959A6fF9C';  // ← change here
const contract = new web3.eth.Contract(contractAbi, contractAddress);

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
    const deployer = accounts[0];
    console.log(' Account used:', deployer);

    // 1. Upload IPFS
    console.log(' Uploading to IPFS…');
    const cid = await uploadToIPFS(filePath);
    console.log(' CID obtained:', cid);

    // 2. Salva CID su blockchain
    console.log(' Saving CID on blockchain...');
    await contract.methods.storeCID(cid).send({ from: deployer });
    console.log(' CID saved on-chain.');

    // 3. Recupera CID da blockchain
    console.log(' Retrieving CID from blockchain...');
    const retrievedCID = await contract.methods.getCID().call();
    console.log(' CID retrieved:', retrievedCID);

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