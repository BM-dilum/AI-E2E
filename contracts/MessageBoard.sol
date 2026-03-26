// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MessageBoard {
    address public owner;
    string public message;
    uint256 public messageCount;

    event MessagePosted(address poster, string message);
    event MessageCleared(address owner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        message = "";
        messageCount = 0;
    }

    function postMessage(string memory newMessage) public {
        message = newMessage;
        messageCount++;
        emit MessagePosted(msg.sender, newMessage);
    }

    function getMessage() public view returns (string memory) {
        return message;
    }

    function getMessageCount() public view returns (uint256) {
        return messageCount;
    }

    function clearMessage() public onlyOwner {
        message = "";
        messageCount = 0;
        emit MessageCleared(owner);
    }
}
