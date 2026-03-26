// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SavingsAccount {
    address public owner;
    uint256 public balance;
    uint256 public depositCount;

    event AccountCreated(address owner);
    event Deposited(address sender, uint256 amount, uint256 balance);
    event Withdrawn(address owner, uint256 amount, uint256 balance);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        balance = 0;
        depositCount = 0;
        emit AccountCreated(msg.sender);
    }

    function deposit() public payable {
        require(msg.value > 0, "No ETH sent");
        balance += msg.value;
        depositCount++;
        emit Deposited(msg.sender, msg.value, balance);
    }

    function withdraw(uint256 amount) public onlyOwner {
        require(amount > 0, "Invalid amount");
        require(amount <= balance, "Insufficient balance");
        balance -= amount;
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdrawn(owner, amount, balance);
    }

    function withdrawAll() public onlyOwner {
        require(balance > 0, "No balance");
        uint256 amount = balance;
        balance = 0;
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdrawn(owner, amount, 0);
    }

    function getBalance() public view returns (uint256) {
        return balance;
    }

    function getDepositCount() public view returns (uint256) {
        return depositCount;
    }
}
