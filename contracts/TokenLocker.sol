pragma solidity ^0.8.20;

contract TokenLocker {
    address public owner;
    uint256 public lockedAmount;
    uint256 public unlockTime;
    bool public isLocked;

    event OwnerSet(address owner);
    event Locked(address owner, uint256 amount, uint256 unlockTime);
    event Unlocked(address owner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        isLocked = false;
        lockedAmount = 0;
        emit OwnerSet(msg.sender);
    }

    function lock(uint256 duration) public payable onlyOwner {
        require(!isLocked, "Already locked");
        require(msg.value > 0, "No ETH sent");
        require(duration > 0, "Invalid duration");
        lockedAmount = msg.value;
        unlockTime = block.timestamp + duration;
        isLocked = true;
        emit Locked(msg.sender, msg.value, unlockTime);
    }

    function unlock() public onlyOwner {
        require(isLocked, "Not locked");
        require(block.timestamp >= unlockTime, "Still locked");
        uint256 amount = lockedAmount;
        isLocked = false;
        lockedAmount = 0;
        (bool success, ) = payable(msg.sender).call{value: amount, gas: 30000}("");
        require(success, "Transfer failed");
        emit Unlocked(msg.sender, amount);
    }

    function getTimeRemaining() public view returns (uint256) {
        if (!isLocked || block.timestamp >= unlockTime) return 0;
        return unlockTime - block.timestamp;
    }

    function getLockedAmount() public view returns (uint256) {
        return lockedAmount;
    }
}