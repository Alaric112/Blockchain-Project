const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const { createVerifiableCredentialJwt, verifyCredential } = require('did-jwt-vc');  //npm install did-jwt-vc


(async () => {
  try {
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);

    // Retrieve accounts and chainId from Ganache
    const accounts = await web3.eth.getAccounts();
    const issuer_address = accounts[0];
    const client_address = accounts[1];
    const chainId = await web3.eth.getChainId();

    // Private key (ensure you use the correct ones for Ganache)
    const issuer_privateKey = '0x3a20e57dbc146c564614c52235654379256f5adcb307320ef48c20e366a48af2';
    const client_privateKey = '0xd11683164c46e04a6b99f740aa8a9a132a11bda45de2c829170b1bc078649612';
    
    // Create the DID specifying the network
    const issuer = new EthrDID({
      identifier: issuer_address,
      privateKey: issuer_privateKey,
      provider: web3.currentProvider,
      chainNameOrId: chainId,
    });

    console.log("Issuer DID is:", issuer.did);

    const client = new EthrDID({
      identifier: client_address,
      privateKey: client_privateKey,
      provider: web3.currentProvider,
      chainNameOrId: chainId,
    });

    console.log("Client DID is:", client.did);    

    // Create the payload for the Verifiable Credential
    const vcPayload = {
      sub: client.did,
      // "nbf" indicates the validity starting from (timestamp in seconds)
      nbf: Math.floor(Date.now() / 1000),
      // The "vc" field contains the VC document
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1", "https://w3id.org/security/bbs/v1", "https://w3id.org/vc/status-list/2021/v1"],
        type: ["VerifiableCredential", "VC_IdentityBinding"],
        issuer: issuer.did, 
        issuanceDate: new Date().toISOString(), 
        credentialSubject: {
          id: client.did,
          status: "verified-user",
          residency: "Italy"
        },
        credentialStatus: {
          id: "https://issuer.gov.it/statuslist/7#1234",
          type: "RevocationList2021Status",
          statusListIndex: "1234",
          statusListCredential: "https://issuer.gov.it/statuslist/7.json"
  }
      }
    };

    // Sign the VC by generating a JWT
    const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);
    console.log("Verifiable Credential JWT:", vcJwt);

  } catch (error) {
    console.error("Error:", error);
  }
})();
