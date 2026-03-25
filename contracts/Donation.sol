// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Donation {
    address public owner;
    uint256 public totalDonations;
    mapping(address => uint256) public donations;

    event OwnerSet(address owner);
    event Donated(address indexed donor, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);

    constructor() {
        owner = msg.sender;
        totalDonations = 0;
        emit OwnerSet(msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function donate() public payable {
        require(msg.value > 0, "No ETH sent");
        
        donations[msg.sender] += msg.value;
        totalDonations += msg.value;
        
        emit Donated(msg.sender, msg.value);
    }

    function withdraw() public onlyOwner {
        require(totalDonations > 0, "No donations");
        
        uint256 amount = address(this).balance;
        totalDonations = 0;
        
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit Withdrawn(owner, amount);
    }

    function getDonation(address donor) public view returns (uint256) {
        return donations[donor];
    }

    function getTotalDonations() public view returns (uint256) {
        return totalDonations;
    }

    receive() external payable {
        donate();
    }
}
