/* SPDX-License-Identifier: MIT */

pragma solidity ^0.8.0;

contract PurchaseAndMint {

    struct Order {
        string merchantDID;
        uint256 cost;
        uint256 expirationDate;
        bytes32 commitment;
    }

    mapping(uint256 => Order) private orders; //orderId => order
    mapping(uint256 =>  bool) private claimedOrders;
    mapping(uint256 => address) private buyers;
    mapping(uint256 => address) private invokerMerchant; //orderId => merchantAddress
    mapping(uint256 => bool) private settledOrders;
    mapping(address => uint256) private escrowedethr; //buyer => ethr escrowed

    event OrderRegistered(uint256 orderId, string shopDID, uint256 price);
    event OrderClaimed(uint256 orderId, address buyer, uint256 cost);
    event OrderSettled(uint256 orderId);

    function registerOrder(uint256 orderId, string calldata shopDID, uint256 price, uint256 expiration, bytes32 commitment) public { 
        require(orders[orderId].expirationDate == 0, "Order already registered!");
        require(invokerMerchant[orderId] == address(0), "Order already registered!");

        orders[orderId] = Order({
            merchantDID : shopDID,
            cost : price,
            expirationDate : expiration,
            commitment : commitment
        });

        invokerMerchant[orderId] = msg.sender; 

        emit OrderRegistered(orderId, shopDID, price);
    }

    function claimOrder(uint256 orderId, bytes32 orderSecret, uint256 payAmount) public {

        require(orders[orderId].expirationDate != 0, "Order don't exists!");
        require(block.timestamp <= orders[orderId].expirationDate, "Window to claim the order has expired!");
        require(keccak256(abi.encodePacked(orderId, orderSecret)) == orders[orderId].commitment, "Only knower of secret can claims the order!");
        require(claimedOrders[orderId] == false, "Order already claimed!");
        require(orders[orderId].cost == payAmount, "Payment amount does not match the cost of the product!");

        claimedOrders[orderId]= true;
        buyers[orderId] = msg.sender;
        escrowedethr[msg.sender] == payAmount;

        emit OrderClaimed(orderId, msg.sender, payAmount);
    }

    function merchantClaim(uint256 orderId) public {
        
        require(invokerMerchant[orderId] == msg.sender, "Only the merchant who originally placed the order can claim it!");
        require(claimedOrders[orderId] == true, "Order not yet claimed by buyer!");
        require(settledOrders[orderId] == false, "Order already settled!");

        address buyer = buyers[orderId];
        escrowedethr[buyer] -= orders[orderId].cost;
        settledOrders[orderId] = true;

        emit OrderSettled(orderId);
    }
}