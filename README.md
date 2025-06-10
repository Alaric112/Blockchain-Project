# Blockchain-Project
Repository of the Blockchain Project

# How to Run the Code

## Prerequisite Software
Visual Studio Code (v1.80+)

Node.js (v18.x LTS)

Ganache (v7.8.0+) - Local blockchain

IPFS Desktop (v0.22.0+) - Decentralized storage

## Clone repository
git clone https://github.com/Alaric112/Blockchain-Project.git

## Install core dependencies
npm install --save-dev web3 solc ganache-core

## Install DID framework modules
npm install ethr-did did-resolver ethr-did-resolver

## Configuration

Start IPFS Desktop and note API port (default: 5001)

Launch Ganache with quickstart workspace

## Running the code

You Have to move to the single directories, in example Phase1and2

cd Phase1and2

To compile the contract source code:

node compile.js

To deploy the contract into the test chain created by Ganache use:

ndoe deploy.js

Now you have to copy the contract address and paste into the variable registryAddress inside the file interact.js
To simulate the use of the signing function by the Trusted Authority and the Holder of the credential we used the private key distributed by Ganache, in the example we considered the first account to be the issuer of the credential, and second account to be the holder.

To execute the final code lunch as previously in the terminal:

node interact.js

The procedure to run the code for every phase is the same as this one: always compile, then deploy the smart contracts on the chain, and finally execute the command and interactions using the interact file. Note that the phase must be executed in order, because some command and operation and controls are based on previous operations.
