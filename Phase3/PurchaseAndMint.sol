/* SPDX-License-Identifier: MIT */

pragma solidity ^0.8.0;

import "./MyTokenNFT.sol";

contract PurchaseAndMint {

    MyTokenNFT public nft;

    struct Order {
        string merchantDID;
        uint256 cost;
        uint256 expirationDate;
        bytes32 commitment;
    }

    mapping(uint256 => Order)   private orders;             // orderId → dati dell’ordine
    mapping(uint256 => bool)    private claimedOrders;      // orderId → “già claimato?”
    mapping(uint256 => address) private buyers;             // orderId → address del buyer (chi ha claimato)
    mapping(uint256 => address) private invokerMerchant;    // orderId → address del merchant che lo ha registrato
    mapping(uint256 => bool)    private settledOrders;      // orderId → “già finalizzato?”
    mapping(address => uint256) private escrowedethr;       // buyer → quantità di ETH in escrow
    mapping(uint256 => uint256) private orderClaimBlock;    // orderId → numero di blocco in cui è stato fatto claim

    event OrderRegistered(uint256 indexed orderId, string shopDID, uint256 price);
    event OrderClaimed(uint256 indexed orderId, address indexed buyer, uint256 cost);
    event OrderSettled(uint256 indexed orderId);

    constructor(address nftAddress) {
        nft = MyTokenNFT(nftAddress);
    }

    // =======================================================
    // 1) registerOrder: chiama il merchant per registrare
    //    un nuovo ordine “off-chain”
    // =======================================================
    function registerOrder(uint256  orderId, string calldata shopDID, uint256  price, uint256  expiration, bytes32  commitment) public {
        
        require(orders[orderId].expirationDate == 0, "Order already registered!");
        require(invokerMerchant[orderId] == address(0), "Order already registered!");

        orders[orderId] = Order({
            merchantDID    : shopDID,
            cost           : price,
            expirationDate : expiration,
            commitment     : commitment
        });

        invokerMerchant[orderId] = msg.sender;
        emit OrderRegistered(orderId, shopDID, price);
    }

    // =======================================================
    // 2) claimOrder: il buyer rivelare l’orderSecret e paga
    // =======================================================
    function claimOrder(uint256 orderId, bytes32 orderSecret, uint256 payAmount) public {

        require(orders[orderId].expirationDate != 0, "Order don't exists!");
        require(block.timestamp <= orders[orderId].expirationDate, "Window to claim the order has expired!");
        require(keccak256(abi.encodePacked(orderId, orderSecret)) == orders[orderId].commitment, "Only knower of secret can claims the order!");
        require(claimedOrders[orderId] == false, "Order already claimed!");
        require(orders[orderId].cost == payAmount, "Payment amount does not match the cost of the product!");

        claimedOrders[orderId]= true;
        buyers[orderId] = msg.sender;
        escrowedethr[msg.sender] = payAmount;
        orderClaimBlock[orderId] = block.number;

        emit OrderClaimed(orderId, msg.sender, payAmount);
    }

    // =======================================================
    // 3) merchantClaim: dopo ≥5 blocchi il merchant “finalizza”
    //    - trasferisce gli ETH al merchant
    //    - chiama nft.mint(buyer) → generiamo un nuovo tokenID sequenziale
    // =======================================================
    function merchantClaim(uint256 orderId) public {
        
        Order storage ord = orders[orderId];

        require(invokerMerchant[orderId] == msg.sender,              "Only merchant can settle!");
        require(claimedOrders[orderId],                              "Order not claimed!");
        require(!settledOrders[orderId],                              "Already settled!");
        require(
            block.number >= (orderClaimBlock[orderId] + 5),
            "Waiting for finality!"
        );

        address buyer = buyers[orderId];

         // 1) Trasferiamo l’ETH all’indirizzo del merchant
        escrowedethr[buyer] -= ord.cost;
        payable(msg.sender).transfer(ord.cost);

        // 2) Mint del proof-of-purchase soulbound al buyer
        //    → `mint` non prende tokenId, lo genera da sé (1, 2, 3, …)
        nft.mint(buyer, orderId, msg.sender);

        settledOrders[orderId] = true;
        emit OrderSettled(orderId);
    }
}