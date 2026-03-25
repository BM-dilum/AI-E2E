// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Whitelist {
    address public owner;
    mapping(address => bool) public whitelist;
    uint256 public count;

    event OwnerSet(address owner);
    event AddressAdded(address addr);
    event AddressRemoved(address addr);

    constructor() {
        owner = msg.sender;
        emit OwnerSet(msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function addAddress(address addr) public onlyOwner {
        require(addr != address(0), "Invalid address");
        require(!whitelist[addr], "Already whitelisted");
        
        whitelist[addr] = true;
        count++;
        emit AddressAdded(addr);
    }

    function removeAddress(address addr) public onlyOwner {
        require(addr != address(0), "Invalid address");
        require(whitelist[addr], "Not whitelisted");
        
        whitelist[addr] = false;
        count--;
        emit AddressRemoved(addr);
    }

    function isWhitelisted(address addr) public view returns (bool) {
        return whitelist[addr];
    }

    function getCount() public view returns (uint256) {
        return count;
    }
}
