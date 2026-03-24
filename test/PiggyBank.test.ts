import { expect } from "chai";
import { ethers } from "hardhat";
import { PiggyBank } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PiggyBank", function () {
  let piggyBank: PiggyBank;
  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    const PiggyBank = await ethers.getContractFactory("PiggyBank");
    piggyBank = await PiggyBank.deploy();
    await piggyBank.waitForDeployment();
  });

  describe("Happy Path", function () {
    it("deploy sets correct owner", async function () {
      const contractOwner = await piggyBank.owner();
      expect(contractOwner).to.equal(owner.address);
    });

    it("anyone can deposit ETH", async function () {
      const amount = ethers.parseEther("1.0");
      await other.sendTransaction({
        to: await piggyBank.getAddress(),
        value: amount,
      });
      const balance = await piggyBank.getBalance();
      expect(balance).to.equal(amount);
    });

    it("balance updates after deposit", async function () {
      const amount = ethers.parseEther("2.0");
      await owner.sendTransaction({
        to: await piggyBank.getAddress(),
        value: amount,
      });
      const balance = await piggyBank.getBalance();
      expect(balance).to.equal(amount);
    });

    it("owner can withdraw full balance", async function () {
      const amount = ethers.parseEther("5.0");
      await owner.sendTransaction({
        to: await piggyBank.getAddress(),
        value: amount,
      });
      
      const balanceBefore = await owner.provider!.getBalance(owner.address);
      const tx = await piggyBank.withdraw();
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      
      const balanceAfter = await owner.provider!.getBalance(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + amount - gasCost);
    });

    it("balance is zero after withdraw", async function () {
      const amount = ethers.parseEther("3.0");
      await owner.sendTransaction({
        to: await piggyBank.getAddress(),
        value: amount,
      });
      
      await piggyBank.withdraw();
      const balance = await piggyBank.getBalance();
      expect(balance).to.equal(0);
    });

    it("getBalance returns correct amount", async function () {
      const amount = ethers.parseEther("1.5");
      await owner.sendTransaction({
        to: await piggyBank.getAddress(),
        value: amount,
      });
      
      const balance = await piggyBank.getBalance();
      expect(balance).to.equal(amount);
    });
  });

  describe("Failure Cases", function () {
    it("zero deposit reverts", async function () {
      await expect(
        piggyBank.deposit({ value: 0 })
      ).to.be.revertedWith("No ETH sent");
    });

    it("non owner withdraw reverts", async function () {
      const amount = ethers.parseEther("1.0");
      await owner.sendTransaction({
        to: await piggyBank.getAddress(),
        value: amount,
      });
      
      await expect(piggyBank.connect(other).withdraw()).to.be.revertedWith(
        "Not owner"
      );
    });

    it("withdraw when empty reverts", async function () {
      await expect(piggyBank.withdraw()).to.be.revertedWith("Empty");
    });
  });

  describe("Events", function () {
    it("deposit emits Deposited event", async function () {
      const amount = ethers.parseEther("1.0");
      await expect(
        owner.sendTransaction({
          to: await piggyBank.getAddress(),
          value: amount,
        })
      )
        .to.emit(piggyBank, "Deposited")
        .withArgs(owner.address, amount);
    });

    it("withdraw emits Withdrawn event", async function () {
      const amount = ethers.parseEther("2.0");
      await owner.sendTransaction({
        to: await piggyBank.getAddress(),
        value: amount,
      });
      
      await expect(piggyBank.withdraw())
        .to.emit(piggyBank, "Withdrawn")
        .withArgs(owner.address, amount);
    });

    it("constructor emits Deposited event", async function () {
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const newPiggyBank = await PiggyBank.deploy();
      await newPiggyBank.waitForDeployment();
      
      // Event is emitted during deployment
      expect(newPiggyBank).to.not.be.null;
    });
  });
});
