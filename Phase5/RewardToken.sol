// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RewardToken {
    // Public variables for name, symbol, decimals, and total supply
    string public name = "RewardToken";
    string public symbol = "MTK";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    // Mapping to track address balances
    mapping(address => uint256) public balanceOf;
    // Mapping for spending allowances (spender)
    mapping(address => mapping(address => uint256)) public allowance;

    // Events for transfer and approval operations
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Constructor initializes the supply and assigns all tokens to the deployer
    constructor(uint256 initialSupply) {
        totalSupply = initialSupply * (10 ** uint256(decimals));  // Adjust the supply with decimals
        balanceOf[msg.sender] = totalSupply;  // Assign the entire supply to the deployer's balance
        emit Transfer(address(0), msg.sender, totalSupply);  // Emit the transfer event
    }

    // Function to transfer tokens to another address
    function transfer(address to, uint256 value) public returns (bool success) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    // Function to approve an address to spend tokens on behalf of the sender
    function approve(address spender, uint256 value) public returns (bool success) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    // Function to transfer tokens from one address to another, subject to approval
    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Not authorized");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }

    // Function to check how much a spender is allowed to spend on behalf of an owner
    function getAllowance(address owner, address spender) public view returns (uint256 remaining) {
        return allowance[owner][spender];
    }
}
