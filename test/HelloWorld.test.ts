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
    helloWorld = await HelloWorld.deploy();
    await helloWorld.waitForDeployment();
  });

  it("deploy sets correct message", async function () {
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

  it("non owner cannot update message", async function () {
    await expect(
      helloWorld.connect(other).setMessage("Unauthorized"),
    ).to.be.revertedWith("Not owner");
  });

  it("empty message reverts", async function () {
    await expect(helloWorld.setMessage("")).to.be.revertedWith("Empty message");
  });
});
