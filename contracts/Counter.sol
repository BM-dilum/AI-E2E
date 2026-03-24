// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Counter {
    uint256 public counter;
    address public owner;

    event CountChanged(address owner, uint256 count);

    constructor() {
        owner = msg.sender;
        counter = 0;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function getCount() public view returns (uint256) {
        return counter;
    }

    function increment() public onlyOwner {
        counter += 1;
        emit CountChanged(msg.sender, counter);
    }

    function decrement() public onlyOwner {
        require(counter > 0, "Counter is zero");
        counter -= 1;
        emit CountChanged(msg.sender, counter);
    }

    function reset() public onlyOwner {
        counter = 0;
        emit CountChanged(msg.sender, 0);
    }
}
