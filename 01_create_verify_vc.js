const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const { createVerifiableCredentialJwt, verifyCredential } = require('did-jwt-vc');
const { Resolver } = require('did-resolver');
const ethrDidResolver = require('ethr-did-resolver');

(async () => {
  try {
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);

    // Retrieve accounts and chainId from Ganache
    const accounts = await web3.eth.getAccounts();
    const address = accounts[0];
    const chainId = await web3.eth.getChainId();

    // Private key (ensure you use the correct one for Ganache)
    const privateKey = '0x673ee4e9f139997646bb15ef0630949a6e817292223ceab600627ebc5fd5673c';

    // Create the DID specifying the network
    const ethrDid = new EthrDID({
      identifier: address,
      privateKey,
      provider: web3.currentProvider,
      chainNameOrId: chainId,
    });

    console.log("Your DID is:", ethrDid.did);

    // Create the payload for the Verifiable Credential
    const vcPayload = {
      sub: ethrDid.did,
      // "nbf" indicates the validity starting from (timestamp in seconds)
      nbf: Math.floor(Date.now() / 1000),
      // The "vc" field contains the VC document
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1", "https://w3id.org/security/bbs/v1", "https://w3id.org/vc/status-list/2021/v1"],
        type: ["VerifiableCredential", "VC_IdentityBinding"],
        issuer: "did:ethr:0x539:0x24A5ED2239a819cF6570d7fe252CB03613947E42", 
        issuanceDate: new Date().toISOString(), 
        credentialSubject: {
          id: ethrDid.did,
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
    const vcJwt = await createVerifiableCredentialJwt(vcPayload, ethrDid);
    console.log("Verifiable Credential JWT:", vcJwt);

    // Retrieve the address of the deployed DID registry (replace this value with the one obtained from Truffle)
    const registryAddress = '0x7a97Aee778ac419b8b9FfA2d358324Cc6288226E'; // Insert the address obtained from the migration

    // Configure the ethr-did-resolver with the deployed registry
    const resolverConfig = {
      networks: [{
        name: chainId, 
        rpcUrl: providerUrl,
        chainId: chainId,
        registry: registryAddress // Specify the DID registry contract here
      }]
    };

    const ethrResolver = ethrDidResolver.getResolver(resolverConfig);
    const didResolver = new Resolver(ethrResolver);

    // Verify the signed VC
    const verifiedVC = await verifyCredential(vcJwt, didResolver);
    console.log("Verified Credential:", JSON.stringify(verifiedVC, null, 2));

  } catch (error) {
    console.error("Error:", error);
  }
})();
