const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
  verifyPresentation
} = require('did-jwt-vc');
const { Resolver } = require('did-resolver');
const ethrDidResolver = require('ethr-did-resolver');
const crypto = require('crypto');
const fs                = require('fs');
const path              = require('path');

// --- helper to measure an eth_call (always gasUsed: 0) ---
async function measureView(label, promise) {
  const start = process.hrtime.bigint();
  await promise;
  const end   = process.hrtime.bigint();
  return {
    label,
    durationMs: Number(end - start) / 1e6,
    gasUsed:   0
  };
}

(async () => {

  const results = []; 

  const providerUrl = 'HTTP://127.0.0.1:7545';
  const web3 = new Web3(providerUrl);
 // Retrieve accounts from Ganache
  const accounts = await web3.eth.getAccounts();
  const address_issuer = accounts[0];
  const address_subject = accounts[1]; // Subject of the VC
  const registryAddress = '0x9CCf1516CAeba5E03125d86Fd7AE1894D429368e'; // <-- replace with the contract address
  const privateKey_issuer = '0x627d4edba5fe8f2a03332af990f4c128ce621463ef04f7b41cf64b9b4a3fb8e5'; // <-- replace with the private key of the address 0
  const privateKey_subject = '0x2076b12e0e3c5b6135a5e19741bcb1541777f9e1f64bb0ebca8431c08b8708de'; // <-- replace with the private key of the address 2
  const chainId = await web3.eth.getChainId();

  // Create issuer DID
  const issuer = new EthrDID({
    identifier: address_issuer,
    privateKey: privateKey_issuer,
    provider: web3.currentProvider,
    chainNameOrId: chainId
  });

   // Create client DID
  const subject = new EthrDID({
    identifier: address_subject,
    privateKey: privateKey_subject,
    provider: web3.currentProvider,
    chainNameOrId: chainId
  });
  
  // === Step 1: Create hashed claims ===
  const claims = {
    id: subject.did,
    status: "verified-user",
    residency: "Italy"
  };

  const salts = {
    id: crypto.randomBytes(16).toString('hex'),
    status: crypto.randomBytes(16).toString('hex'),
    residency: crypto.randomBytes(16).toString('hex')
  };

  /*const hashedClaims = {
    idHash: crypto.createHash('sha256').update(salts.id + claims.id).digest('hex'),
    statusHash: crypto.createHash('sha256').update(salts.status + claims.status).digest('hex'),
    residencyHash: crypto.createHash('sha256').update(salts.residency + claims.residency).digest('hex')
  };*/

  // === Step 2: Issue the VC containing only the hashes ===
  const now = Math.floor(Date.now() / 1000);
  const hashedClaimsArray = [
    crypto.createHash('sha256').update(salts.id + claims.id).digest('hex'),
    crypto.createHash('sha256').update(salts.status + claims.status).digest('hex'),
    crypto.createHash('sha256').update(salts.residency + claims.residency).digest('hex')
  ];

  const vcPayload = {
    sub: subject.did,
    nbf: now,
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1", "https://w3id.org/security/bbs/v1", "https://w3id.org/vc/status-list/2021/v1"],
        type: ["VerifiableCredential", "VC_IdentityBinding"],
        issuer: issuer.did, 
        issuanceDate: new Date().toISOString(), 
        credentialSubject: {
          hashes: hashedClaimsArray
        },
        credentialStatus: {
          id: "https://issuer.gov.it/statuslist/7#1234",
          type: "RevocationList2021Status",
          statusListIndex: "1234",
          statusListCredential: "https://issuer.gov.it/statuslist/7.json"
        }
      }
  };

  const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);
  console.log("\n Signed VC (with hashed claims):\n", vcJwt);

  // === Step 3: Simulate selective disclosure 
  const disclosedClaims = [
    {
    field: "id",
    value: claims.id,
    salt: salts.id
  }, {
    field: "status",
    value: claims.status,
    salt: salts.status
  }
];

  const vpPayload = {
    vp: {
      "@context": ["https://www.w3.org/2018/credentials/v1", "https://w3id.org/security/bbs/v1", "https://w3id.org/vc/status-list/2021/v1"],
      type: ["VerifiablePresentation"],
      verifiableCredential: [vcJwt]
    },
    disclosedClaims,
    challenge : "0xCHALLENGE"
  };

  const vpJwt = await createVerifiablePresentationJwt(vpPayload, subject);
  console.log("\n Signed VP with disclosed claims:\n", vpJwt);

  
  // === Step 4: Verify the VP ===
  const resolver = new Resolver(ethrDidResolver.getResolver({
    networks: [{
      name: chainId,
      rpcUrl: providerUrl,
      chainId: chainId,
      registry: registryAddress
    }]
  }));

  // Measure how long resolve() itself takes
  // results.push(await measureView(
  //  'resolver.resolve(subject.did)',
  //  resolver.resolve(subject.did)
  // ));

  // Measure full VP verification (includes all on‑chain calls)
  // results.push(await measureView(
  //  'verifyPresentation(vpJwt)',
  //  verifyPresentation(vpJwt, resolver)
  // ));

  // Measure full VP verification (includes all on‑chain calls)
  results.push(await measureView(
    'verifyPresentation (alone)',
    verifyPresentation(vpJwt, resolver)
  ));

  try {
    const verified = await verifyPresentation(vpJwt, resolver);
    console.log("\n VP verification successful. VP content:\n", JSON.stringify(verified, null, 2));

    const disclosed = verified.verifiablePresentation.disclosedClaims;
    // Decode the VC JWT
    const vcObject = verified.verifiablePresentation.verifiableCredential[0];
    const storedHashes = vcObject.credentialSubject.hashes; // Retrieve the array of hashes

    // Iterate over the hashes and compare with the disclosed claim
    let match = 0;
    for (const storedHash of storedHashes) {
      const id_recomputedHash = crypto.createHash('sha256').update(disclosed[0].salt + disclosed[0].value).digest('hex');
      const status_recomputedHash = crypto.createHash('sha256').update(disclosed[1].salt + disclosed[1].value).digest('hex');
      if (storedHash === id_recomputedHash || storedHash === status_recomputedHash) {
        match++;
      }
    if(match == 2) {
      console.log(`\n Match found for the disclosed claims:\n${JSON.stringify(disclosed, null, 2)}`);
      break;
    }
    }

    if (match != 2) {
      console.log("\n No match found for the disclosed claims.");
    }
  } catch (err) {
    console.error("\n Error during VP verification:", err);
  }

    console.log("\n=== TEST COMPLETATO ===");
    console.log("\n=== STAMPA RISULTATI ===");
    
    // Stampa misurazioni finale
    console.table(results, ['label', 'durationMs', 'gasUsed']);

    // Scegli un “base name” per i file
    const phaseName = 'Phase1and2';

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

})();