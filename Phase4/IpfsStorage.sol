// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract IpfsStorage {
    string private storedCID;

    // Salva il CID nel contratto
    function storeCID(string memory _cid) public {
        storedCID = _cid;
    }

    // Restituisce il CID memorizzato
    function getCID() public view returns (string memory) {
        return storedCID;
    }
}
