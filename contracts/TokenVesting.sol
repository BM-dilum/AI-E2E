// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenVesting is ReentrancyGuard {
    IERC20 public token;
    address public beneficiary;
    address public owner;
    uint256 public start;
    uint256 public cliff;
    uint256 public duration;
    uint256 public totalAmount;
    uint256 public released;

    event VestingCreated(
        address indexed beneficiary,
        uint256 amount,
        uint256 cliff,
        uint256 duration
    );
    event Deposited(address indexed owner, uint256 amount);
    event Released(address indexed beneficiary, uint256 amount);
    event Revoked(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAfterCliff() {
        require(block.timestamp >= cliff, "Cliff not reached");
        _;
    }

    constructor(
        address _token,
        address _beneficiary,
        uint256 _cliff,
        uint256 _duration
    ) {
        require(_token != address(0), "Invalid token");
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_cliff > 0, "Cliff must be > 0");
        require(_duration > _cliff, "Duration must exceed cliff");

        token = IERC20(_token);
        beneficiary = _beneficiary;
        owner = msg.sender;
        start = block.timestamp;
        cliff = start + _cliff;
        duration = _duration;

        emit VestingCreated(_beneficiary, 0, cliff, _duration);
    }

    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        require(totalAmount == 0, "Already deposited");

        totalAmount = amount;
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        emit Deposited(msg.sender, amount);
    }

    function release() external onlyAfterCliff nonReentrant {
        uint256 releasableAmount = vestedAmount() - released;
        require(releasableAmount > 0, "Nothing to release");

        released += releasableAmount;
        require(token.transfer(beneficiary, releasableAmount), "Transfer failed");

        emit Released(beneficiary, releasableAmount);
    }

    function vestedAmount() public view returns (uint256) {
        if (block.timestamp < cliff) {
            return 0;
        }

        if (block.timestamp >= start + duration) {
            return totalAmount;
        }

        return (totalAmount * (block.timestamp - start)) / duration;
    }

    function releasable() public view returns (uint256) {
        return vestedAmount() - released;
    }

    function revoke() external onlyOwner nonReentrant {
        require(totalAmount > 0, "Nothing to revoke");

        uint256 unreleased = totalAmount - released;
        totalAmount = 0;

        require(token.transfer(owner, unreleased), "Transfer failed");

        emit Revoked(owner, unreleased);
    }
}
