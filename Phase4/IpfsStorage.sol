// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Phase3/MyTokenNFT.sol";

contract IpfsStorage {

    struct Review {
        address holder;
        string ipfsCID;       
        address shop;      
        uint256 timestamp;
        uint256 netScore;
        bool revoked;
    }

    MyTokenNFT public nft;

    mapping(uint256 => Review) private submittedReviews;    //nftId => Review
    mapping(address => mapping(address => bool)) private reviewerMerchantBinding;    //submitter => submittedShop

    event StoredCID(string cid, address shop);
    event ReviewModified(string cid, address shop);
    event ReviewDeleted(string cid);

    constructor(address nftAddress) {
        nft = MyTokenNFT(nftAddress);
    } 

    // Salva il CID nel contratto
    function storeCID(uint256 nftId, address submitter, address submittedShop, string memory _cid) public {

        require(nft.ownerOf(nftId) == submitter, "User submitting the review is not true owner of the NFT!");
        require(submittedReviews[nftId].timestamp == 0, "Token already spent to submit a review!");
        require(!reviewerMerchantBinding[submitter][submittedShop], "User submitting the review has already reviewed this merchant!");
        
        (, , MyTokenNFT.TokenURI memory tokenURI) = nft.tokensId(nftId);
        address trueMerchant = tokenURI.merchant;
        require(trueMerchant == submittedShop, "The submitted store address does not match the merchant DID registered on the blockchain for the specified NFT!");
        
        submittedReviews[nftId] = Review ({
            holder : submitter,
            ipfsCID : _cid,
            shop : submittedShop,
            timestamp : block.timestamp,
            netScore : 0,
            revoked : false
        });

        reviewerMerchantBinding[submitter][submittedShop] = true;

        emit StoredCID(_cid, submittedShop);
    }

    // Restituisce il CID memorizzato
    function getCID(uint256 nftId) public view returns (string memory) {
        return submittedReviews[nftId].ipfsCID;
    }

    function modifyReview(uint256 nftId, string memory newCID) public {

        require(nft.exists(nftId), "Token does not exists!");
        require(nft.ownerOf(nftId) == msg.sender, "User is not true holder of the NFT!");       
        require(!submittedReviews[nftId].revoked, "Review deleted!");  

        string memory oldCID = submittedReviews[nftId].ipfsCID;
        submittedReviews[nftId].ipfsCID = newCID;
        submittedReviews[nftId].timestamp = block.timestamp;
        submittedReviews[nftId].netScore = 0;

        emit ReviewModified(oldCID, submittedReviews[nftId].shop);
    }

    function deleteReview(uint256 nftId) public {

        require(nft.exists(nftId), "Token does not exists!");
        require(nft.ownerOf(nftId) == msg.sender, "User is not true holder of the NFT!");    
        require(!submittedReviews[nftId].revoked, "Review already deleted!");  

        string memory oldCID = submittedReviews[nftId].ipfsCID;
        submittedReviews[nftId].ipfsCID = "";
        submittedReviews[nftId].shop = address(0);
        submittedReviews[nftId].timestamp = 0;
        submittedReviews[nftId].netScore = 0;
        submittedReviews[nftId].revoked = true;

        emit ReviewDeleted(oldCID);

    }
}
