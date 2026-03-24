// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HelloWorld {
    string public message;
    address public owner;

    event MessageSet(address indexed owner, string message);

    constructor(string memory _message) {
        require(bytes(_message).length > 0, "Empty message");
        owner = msg.sender;
        message = _message;
        emit MessageSet(msg.sender, _message);
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
        emit MessageSet(msg.sender, newMessage);
    }
}
