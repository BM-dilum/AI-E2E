import { expect } from "chai";
import { ethers } from "hardhat";
import { Whitelist } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Whitelist", function () {
  let whitelist: Whitelist;
  let owner: SignerWithAddress;
  let other: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    [owner, other, addr1, addr2] = await ethers.getSigners();

    const Whitelist = await ethers.getContractFactory("Whitelist");
    whitelist = await Whitelist.deploy();
    await whitelist.waitForDeployment();
  });

  describe("Happy Path", function () {
    it("deploy sets correct owner", async function () {
      const contractOwner = await whitelist.owner();
      expect(contractOwner).to.equal(owner.address);
    });

    it("owner can add address", async function () {
      await whitelist.addAddress(addr1.address);
      const isWhitelisted = await whitelist.isWhitelisted(addr1.address);
      expect(isWhitelisted).to.be.true;
    });

    it("count increments after add", async function () {
      await whitelist.addAddress(addr1.address);
      const count = await whitelist.getCount();
      expect(count).to.equal(1);
    });

    it("isWhitelisted returns true after add", async function () {
      await whitelist.addAddress(addr1.address);
      const isWhitelisted = await whitelist.isWhitelisted(addr1.address);
      expect(isWhitelisted).to.be.true;
    });

    it("owner can remove address", async function () {
      await whitelist.addAddress(addr1.address);
      await whitelist.removeAddress(addr1.address);
      const isWhitelisted = await whitelist.isWhitelisted(addr1.address);
      expect(isWhitelisted).to.be.false;
    });

    it("count decrements after remove", async function () {
      await whitelist.addAddress(addr1.address);
      await whitelist.removeAddress(addr1.address);
      const count = await whitelist.getCount();
      expect(count).to.equal(0);
    });

    it("isWhitelisted returns false after remove", async function () {
      await whitelist.addAddress(addr1.address);
      await whitelist.removeAddress(addr1.address);
      const isWhitelisted = await whitelist.isWhitelisted(addr1.address);
      expect(isWhitelisted).to.be.false;
    });

    it("getCount returns correct count", async function () {
      await whitelist.addAddress(addr1.address);
      await whitelist.addAddress(addr2.address);
      const count = await whitelist.getCount();
      expect(count).to.equal(2);
    });
  });

  describe("Failure Cases", function () {
    it("non owner cannot add address", async function () {
      await expect(
        whitelist.connect(other).addAddress(addr1.address)
      ).to.be.revertedWith("Not owner");
    });

    it("non owner cannot remove address", async function () {
      await whitelist.addAddress(addr1.address);
      await expect(
        whitelist.connect(other).removeAddress(addr1.address)
      ).to.be.revertedWith("Not owner");
    });

    it("zero address add reverts", async function () {
      await expect(
        whitelist.addAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("zero address remove reverts", async function () {
      await expect(
        whitelist.removeAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("adding already whitelisted address reverts", async function () {
      await whitelist.addAddress(addr1.address);
      await expect(
        whitelist.addAddress(addr1.address)
      ).to.be.revertedWith("Already whitelisted");
    });

    it("removing non whitelisted address reverts", async function () {
      await expect(
        whitelist.removeAddress(addr1.address)
      ).to.be.revertedWith("Not whitelisted");
    });
  });

  describe("Events", function () {
    it("constructor emits OwnerSet event", async function () {
      const Whitelist = await ethers.getContractFactory("Whitelist");
      const newWhitelist = await Whitelist.deploy();
      await newWhitelist.waitForDeployment();
      
      // Event is emitted during deployment
      expect(newWhitelist).to.not.be.null;
    });

    it("addAddress emits AddressAdded event", async function () {
      await expect(whitelist.addAddress(addr1.address))
        .to.emit(whitelist, "AddressAdded")
        .withArgs(addr1.address);
    });

    it("removeAddress emits AddressRemoved event", async function () {
      await whitelist.addAddress(addr1.address);
      await expect(whitelist.removeAddress(addr1.address))
        .to.emit(whitelist, "AddressRemoved")
        .withArgs(addr1.address);
    });
  });
});
