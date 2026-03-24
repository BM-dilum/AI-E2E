// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HelloWorld {
    string public message;
    address public owner;

    event MessageUpdated(address owner, string message);

    constructor() {
        owner = msg.sender;
        message = "Hello World";
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function getMessage() public view returns (string memory) {
        return message;
    }

    function setMessage(string memory newMessage) public onlyOwner {
        require(bytes(newMessage).length > 0, "Empty message");
        message = newMessage;
        emit MessageUpdated(msg.sender, newMessage);
    }
}
