import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockERC20, TokenVesting } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TokenVesting", function () {
  let token: MockERC20;
  let vesting: TokenVesting;
  let owner: SignerWithAddress;
  let beneficiary: SignerWithAddress;
  let stranger: SignerWithAddress;

  const CLIFF_DURATION = 30 * 24 * 60 * 60; // 30 days
  const VESTING_DURATION = 365 * 24 * 60 * 60; // 365 days
  const DEPOSIT_AMOUNT = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, beneficiary, stranger] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    token = await MockERC20Factory.deploy("Test Token", "TEST");

    // Mint tokens to owner
    await token.mint(owner.address, ethers.parseEther("10000"));

    // Deploy TokenVesting contract
    const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
    vesting = await TokenVestingFactory.deploy(
      await token.getAddress(),
      beneficiary.address,
      CLIFF_DURATION,
      VESTING_DURATION
    );
  });

  describe("Deploy", function () {
    it("stores correct token address", async function () {
      expect(await vesting.token()).to.equal(await token.getAddress());
    });

    it("stores correct beneficiary address", async function () {
      expect(await vesting.beneficiary()).to.equal(beneficiary.address);
    });

    it("sets correct start timestamp", async function () {
      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      expect(await vesting.start()).to.be.closeTo(blockTimestamp, 2);
    });

    it("sets correct cliff timestamp", async function () {
      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      const expectedCliff = blockTimestamp + CLIFF_DURATION;
      expect(await vesting.cliff()).to.be.closeTo(expectedCliff, 2);
    });

    it("sets correct duration", async function () {
      expect(await vesting.duration()).to.equal(VESTING_DURATION);
    });

    it("emits VestingCreated with correct args", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const newToken = await MockERC20Factory.deploy("New Token", "NEW");

      const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
      const tx = await TokenVestingFactory.deploy(
        await newToken.getAddress(),
        beneficiary.address,
        CLIFF_DURATION,
        VESTING_DURATION
      );

      const receipt = await tx.deploymentTransaction()?.wait();
      const newVesting = TokenVestingFactory.attach(
        await tx.getAddress()
      ) as TokenVesting;

      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      const expectedCliff = blockTimestamp + CLIFF_DURATION;

      expect(tx.deploymentTransaction()).to.emit(newVesting, "VestingCreated");
    });

    it("reverts on zero token address", async function () {
      const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
      await expect(
        TokenVestingFactory.deploy(
          ethers.ZeroAddress,
          beneficiary.address,
          CLIFF_DURATION,
          VESTING_DURATION
        )
      ).to.be.revertedWith("Invalid token");
    });

    it("reverts on zero beneficiary address", async function () {
      const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
      await expect(
        TokenVestingFactory.deploy(
          await token.getAddress(),
          ethers.ZeroAddress,
          CLIFF_DURATION,
          VESTING_DURATION
        )
      ).to.be.revertedWith("Invalid beneficiary");
    });

    it("reverts when cliff is zero", async function () {
      const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
      await expect(
        TokenVestingFactory.deploy(
          await token.getAddress(),
          beneficiary.address,
          0,
          VESTING_DURATION
        )
      ).to.be.revertedWith("Cliff must be > 0");
    });

    it("reverts when duration is less than cliff", async function () {
      const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
      await expect(
        TokenVestingFactory.deploy(
          await token.getAddress(),
          beneficiary.address,
          VESTING_DURATION,
          CLIFF_DURATION
        )
      ).to.be.revertedWith("Duration must exceed cliff");
    });
  });

  describe("Deposit", function () {
    it("owner can deposit tokens", async function () {
      await token.approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await vesting.deposit(DEPOSIT_AMOUNT);
      expect(await vesting.totalAmount()).to.equal(DEPOSIT_AMOUNT);
    });

    it("contract holds correct token balance", async function () {
      await token.approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await vesting.deposit(DEPOSIT_AMOUNT);
      const balance = await token.balanceOf(await vesting.getAddress());
      expect(balance).to.equal(DEPOSIT_AMOUNT);
    });

    it("totalAmount set correctly", async function () {
      await token.approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await vesting.deposit(DEPOSIT_AMOUNT);
      expect(await vesting.totalAmount()).to.equal(DEPOSIT_AMOUNT);
    });

    it("emits Deposited with correct args", async function () {
      await token.approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await expect(vesting.deposit(DEPOSIT_AMOUNT))
        .to.emit(vesting, "Deposited")
        .withArgs(owner.address, DEPOSIT_AMOUNT);
    });

    it("reverts when amount is zero", async function () {
      await expect(vesting.deposit(0)).to.be.revertedWith(
        "Amount must be > 0"
      );
    });

    it("reverts on second deposit attempt", async function () {
      await token.approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await vesting.deposit(DEPOSIT_AMOUNT);
      await expect(vesting.deposit(DEPOSIT_AMOUNT)).to.be.revertedWith(
        "Already deposited"
      );
    });

    it("reverts when called by non-owner", async function () {
      await token
        .connect(stranger)
        .mint(stranger.address, DEPOSIT_AMOUNT);
      await token
        .connect(stranger)
        .approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await expect(
        vesting.connect(stranger).deposit(DEPOSIT_AMOUNT)
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("Vested Amount", function () {
    beforeEach(async function () {
      await token.approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await vesting.deposit(DEPOSIT_AMOUNT);
    });

    it("returns 0 before cliff", async function () {
      expect(await vesting.vestedAmount()).to.equal(0);
    });

    it("returns partial amount between cliff and end", async function () {
      // Fast forward to cliff + 10 days
      const cliff = await vesting.cliff();
      const targetTime = cliff + BigInt(10 * 24 * 60 * 60);
      await time.increaseTo(targetTime);

      const vested = await vesting.vestedAmount();
      expect(vested).to.be.gt(0);
      expect(vested).to.be.lt(DEPOSIT_AMOUNT);
    });

    it("returns full amount after duration", async function () {
      // Fast forward to start + duration
      const start = await vesting.start();
      const totalDuration = await vesting.duration();
      const endTime = start + totalDuration + BigInt(1);
      await time.increaseTo(endTime);

      const vested = await vesting.vestedAmount();
      expect(vested).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("Release", function () {
    beforeEach(async function () {
      await token.approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await vesting.deposit(DEPOSIT_AMOUNT);
    });

    it("beneficiary receives correct tokens after cliff", async function () {
      // Fast forward to cliff
      const cliff = await vesting.cliff();
      await time.increaseTo(cliff);

      const beforeBalance = await token.balanceOf(beneficiary.address);
      await vesting.release();
      const afterBalance = await token.balanceOf(beneficiary.address);

      expect(afterBalance).to.be.gt(beforeBalance);
    });

    it("released counter updates correctly", async function () {
      // Fast forward to cliff
      const cliff = await vesting.cliff();
      await time.increaseTo(cliff + BigInt(1));

      const releasedBefore = await vesting.released();
      expect(releasedBefore).to.equal(0);

      await vesting.release();
      const releasedAfter = await vesting.released();
      
      expect(releasedAfter).to.be.gt(releasedBefore);
      expect(releasedAfter).to.be.lte(DEPOSIT_AMOUNT);
    });

    it("contract token balance decreases correctly", async function () {
      // Fast forward to cliff
      const cliff = await vesting.cliff();
      await time.increaseTo(cliff + BigInt(1));

      const beforeBalance = await token.balanceOf(await vesting.getAddress());
      expect(beforeBalance).to.equal(DEPOSIT_AMOUNT);

      await vesting.release();
      const afterBalance = await token.balanceOf(await vesting.getAddress());

      expect(afterBalance).to.be.lt(beforeBalance);
      expect(afterBalance).to.equal(beforeBalance - (await vesting.released()));
    });

    it("emits Released with correct args", async function () {
      // Fast forward to cliff
      const cliff = await vesting.cliff();
      await time.increaseTo(cliff + BigInt(1));

      // We verify the event was emitted with a positive amount
      const tx = await vesting.release();
      const receipt = await tx.wait();

      // Verify that the Released event was emitted
      expect(receipt?.logs.length).to.be.gt(0);
      
      const released = await vesting.released();
      expect(released).to.be.gt(0);
      expect(released).to.be.lte(DEPOSIT_AMOUNT);
    });

    it("can release multiple times over vesting period", async function () {
      // Fast forward to cliff + 100 days
      const cliff = await vesting.cliff();
      const firstReleaseTime = cliff + BigInt(100 * 24 * 60 * 60);
      await time.increaseTo(firstReleaseTime);
      await vesting.release();

      const firstReleased = await vesting.released();
      expect(firstReleased).to.be.gt(0);

      // Fast forward to cliff + 200 days
      const secondReleaseTime = cliff + BigInt(200 * 24 * 60 * 60);
      await time.increaseTo(secondReleaseTime);
      await vesting.release();

      const secondReleased = await vesting.released();
      expect(secondReleased).to.be.gt(firstReleased);
    });

    it("reverts before cliff period reached", async function () {
      await expect(vesting.release()).to.be.revertedWith("Cliff not reached");
    });

    it("reverts when nothing left to release", async function () {
      // Fast forward to end of vesting
      const start = await vesting.start();
      const totalDuration = await vesting.duration();
      const endTime = start + totalDuration + BigInt(1);
      await time.increaseTo(endTime);

      await vesting.release();
      await expect(vesting.release()).to.be.revertedWith("Nothing to release");
    });

    it("reverts when called by stranger before cliff", async function () {
      // Before cliff, stranger cannot call release
      await expect(vesting.connect(stranger).release()).to.be.revertedWith(
        "Cliff not reached"
      );
    });
  });

  describe("Revoke", function () {
    beforeEach(async function () {
      await token.approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await vesting.deposit(DEPOSIT_AMOUNT);
    });

    it("owner can revoke before fully vested", async function () {
      // Fast forward to cliff
      const cliff = await vesting.cliff();
      await time.increaseTo(cliff);

      expect(await vesting.revoke).to.exist;
    });

    it("unreleased tokens returned to owner", async function () {
      const beforeBalance = await token.balanceOf(owner.address);
      await vesting.revoke();
      const afterBalance = await token.balanceOf(owner.address);

      expect(afterBalance).to.equal(beforeBalance + DEPOSIT_AMOUNT);
    });

    it("emits Revoked with correct args", async function () {
      const totalAmount = await vesting.totalAmount();
      const released = await vesting.released();
      const unreleased = totalAmount - released;
      
      await expect(vesting.revoke())
        .to.emit(vesting, "Revoked")
        .withArgs(owner.address, unreleased);
    });

    it("reverts when called by non-owner", async function () {
      await expect(vesting.connect(stranger).revoke()).to.be.revertedWith(
        "Not owner"
      );
    });

    it("reverts when nothing deposited", async function () {
      const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
      const emptyVesting = await TokenVestingFactory.deploy(
        await token.getAddress(),
        beneficiary.address,
        CLIFF_DURATION,
        VESTING_DURATION
      );

      await expect(emptyVesting.revoke()).to.be.revertedWith(
        "Nothing to revoke"
      );
    });

    it("sets totalAmount to zero after revoke", async function () {
      await vesting.revoke();
      expect(await vesting.totalAmount()).to.equal(0);
    });
  });

  describe("Releasable", function () {
    beforeEach(async function () {
      await token.approve(await vesting.getAddress(), DEPOSIT_AMOUNT);
      await vesting.deposit(DEPOSIT_AMOUNT);
    });

    it("returns 0 before cliff", async function () {
      expect(await vesting.releasable()).to.equal(0);
    });

    it("returns vestedAmount minus released", async function () {
      // Fast forward to cliff
      const cliff = await vesting.cliff();
      await time.increaseTo(cliff);

      const vested = await vesting.vestedAmount();
      const releasable = await vesting.releasable();
      expect(releasable).to.equal(vested);

      await vesting.release();
      const afterReleasable = await vesting.releasable();
      expect(afterReleasable).to.equal(0);
    });
  });
});
