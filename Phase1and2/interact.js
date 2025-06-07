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

(async () => {
  const providerUrl = 'HTTP://127.0.0.1:7545';
  const web3 = new Web3(providerUrl);
  // Retrieve accounts from Ganache
  const accounts = await web3.eth.getAccounts();
  const address_issuer = accounts[0];
  const address_subject = accounts[2]; // Subject of the VC
  const privateKey_issuer = '0x1136254ec073b0f6c349ccb2c7d147ebc3a15d6e67626ea6f26e174427851dc2';
  const privateKey_subject = '0xa32fc35d4e94275cfceb5cdc6a3e02e28c39696514358b066f5b632f0fc6d54e'; // Subject of the VC
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
  const registryAddress = '0xf170c4f0c751920bef24E09A9799D46E37b6Db5D'; // <-- replace with the DID contract address
  const resolver = new Resolver(ethrDidResolver.getResolver({
    networks: [{
      name: chainId,
      rpcUrl: providerUrl,
      chainId: chainId,
      registry: registryAddress
    }]
  }));

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
})();

/**Quelle stampe extra (come disclosedClaims, didResolutionResult, didDocument, verificationMethod, ecc.) 
 * sono la struttura interna del risultato della funzione verifyPresentation(...), che stai stampando:
 *Il valore verified contiene:
verifiablePresentation, ovvero l'intera presentazione verificata, con:
@context, type, verifiableCredential
disclosedClaims: che hai specificato tu nel vpPayload
proof: la firma JWT della VP
holder: il DID del soggetto
didResolutionResult, didDocument, ecc.: sono metadati di risoluzione DID, ottenuti automaticamente dal resolver per validare la firma associata alla presentazione. */