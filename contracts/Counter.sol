// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Counter {
    uint256 public count;
    address public owner;

    event CountChanged(address owner, uint256 count);

    constructor() {
        owner = msg.sender;
        count = 0;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function getCount() public view returns (uint256) {
        return count;
    }

    function increment() public onlyOwner {
        count += 1;
        emit CountChanged(msg.sender, count);
    }

    function decrement() public onlyOwner {
        require(count > 0, "Count is zero");
        count -= 1;
        emit CountChanged(msg.sender, count);
    }

    function reset() public onlyOwner {
        count = 0;
        emit CountChanged(msg.sender, 0);
    }
}
