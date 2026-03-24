// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PiggyBank {
    address public owner;

    event Deposited(address indexed sender, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);

    constructor() {
        owner = msg.sender;
        emit Deposited(owner, 0);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function deposit() public payable {
        require(msg.value > 0, "No ETH sent");
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw() public onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "Empty");
        
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit Withdrawn(owner, amount);
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
}
