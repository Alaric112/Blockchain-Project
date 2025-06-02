const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');    //npm install ethr-did 

// URL of the Ganache provider
const web3 = new Web3('HTTP://127.0.0.1:7545');

(async () => {
  try {
    // Get available accounts from Ganache
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
      console.error("No accounts found on Ganache.");
      return;
    }
    const address = accounts[1];

    // Private key of the selected account.
    // For Ganache, for example, the first default account has a known private key:
    const privateKey = '0xff16c9f28c9afa73422de10adce3b8eb33821b2ea2a3116a9ef58e3c9761cab1';
    // Ensure the private key matches the chosen account.
    // Retrieve the chain ID from the network (Ganache typically uses 1337 or 5777)
    const chainId = await web3.eth.getChainId();

    // Create an Ethereum-based DID instance using the current web3 provider
    const ethrDid = new EthrDID({ identifier: address, privateKey, provider: web3.currentProvider, chainNameOrId: chainId });

    console.log("Your DID is:", ethrDid.did);
  } catch (err) {
    console.error("Error creating the DID:", err);
  }
})();
