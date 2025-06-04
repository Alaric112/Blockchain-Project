/* SPDX-License-Identifier: MIT */

pragma solidity ^0.8.0;

contract PurchaseAndMint {

    struct Order {
        string merchantDID;
        string cost;
        uint256 expirationDate;
        bytes32 commitment;
    }

    mapping(uint256 => Order) private orders; //orderId => order
    mapping(uint256 => bool) private claimedOrders;

    event OrderRegistered(uint256 orderId, string shopDID, string price);
    event OrderClaimed(uint256 orderId, string cost);

    function registerOrder(uint256 orderId, string calldata shopDID, string calldata price, uint256 expiration, bytes32 commitment) public { //price dovrebbe essere float

        require(orders[orderId].expirationDate == 0, "Order already registered!");
        
        orders[orderId] = Order({
            merchantDID : shopDID,
            cost : price,
            expirationDate : expiration,
            commitment : commitment
        });

        emit OrderRegistered(orderId, shopDID, price);
    }

    function claimOrder(uint256 orderId, bytes32 orderSecret, string calldata payAmount) public { // payAmount dovrebbe essere un float

        require(orders[orderId].expirationDate != 0, "Order don't exists!");
        require(block.timestamp <= orders[orderId].expirationDate, "Window to claim the order has expired!");
        require(keccak256(abi.encodePacked(orderId, orderSecret)) == orders[orderId].commitment, "Only true buyer can claims the order!");
        require(claimedOrders[orderId] == false, "Order already claimed!");
        require(keccak256(abi.encodePacked(orders[orderId].cost)) == keccak256(abi.encodePacked(payAmount)), "Payment amount does not match the cost of the product!");

        claimedOrders[orderId] == true;

        emit OrderClaimed(orderId, payAmount);
    }
}