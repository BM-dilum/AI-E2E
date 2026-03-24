import { expect } from "chai";
import { ethers } from "hardhat";
import { HelloWorld } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("HelloWorld", function () {
  let helloWorld: HelloWorld;
  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    helloWorld = await HelloWorld.deploy("Hello World");
  });

  describe("Happy Path", function () {
    it("deploys with correct message", async function () {
      const msg = await helloWorld.getMessage();
      expect(msg).to.equal("Hello World");
    });

    it("getMessage returns correct message", async function () {
      const msg = await helloWorld.getMessage();
      expect(msg).to.equal("Hello World");
    });

    it("owner can update message", async function () {
      await helloWorld.setMessage("Updated Message");
      const msg = await helloWorld.getMessage();
      expect(msg).to.equal("Updated Message");
    });

    it("event emitted on deploy", async function () {
      const HelloWorld = await ethers.getContractFactory("HelloWorld");
      const instance = await HelloWorld.deploy("Deploy Event");
      await instance.waitForDeployment();
      
      const filter = instance.filters.MessageSet();
      const events = await instance.queryFilter(filter);
      
      expect(events.length).to.equal(1);
      expect(events[0].args[0]).to.equal(owner.address);
      expect(events[0].args[1]).to.equal("Deploy Event");
    });

    it("event emitted on update", async function () {
      await expect(helloWorld.setMessage("New Message"))
        .to.emit(helloWorld, "MessageSet")
        .withArgs(owner.address, "New Message");
    });
  });

  describe("Failure Cases", function () {
    it("empty message on deploy reverts", async function () {
      const HelloWorld = await ethers.getContractFactory("HelloWorld");
      await expect(HelloWorld.deploy("")).to.be.revertedWith("Empty message");
    });

    it("empty message on update reverts", async function () {
      await expect(helloWorld.setMessage("")).to.be.revertedWith(
        "Empty message"
      );
    });

    it("non owner update reverts", async function () {
      await expect(
        helloWorld.connect(other).setMessage("Unauthorized")
      ).to.be.revertedWith("Not owner");
    });
  });
});
