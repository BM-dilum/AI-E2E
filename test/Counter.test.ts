import { expect } from "chai";
import { ethers } from "hardhat";
import { Counter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Counter", function () {
  let counter: Counter;
  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    const Counter = await ethers.getContractFactory("Counter");
    counter = await Counter.deploy();
    await counter.waitForDeployment();
  });

  describe("Happy Path", function () {
    it("deploy sets count to 0", async function () {
      const count = await counter.getCount();
      expect(count).to.equal(0);
    });

    it("getCount returns 0 on deploy", async function () {
      const count = await counter.getCount();
      expect(count).to.equal(0);
    });

    it("owner can increment", async function () {
      await counter.increment();
      const count = await counter.getCount();
      expect(count).to.equal(1);
    });

    it("owner can decrement", async function () {
      await counter.increment();
      await counter.decrement();
      const count = await counter.getCount();
      expect(count).to.equal(0);
    });

    it("owner can reset", async function () {
      await counter.increment();
      await counter.increment();
      await counter.reset();
      const count = await counter.getCount();
      expect(count).to.equal(0);
    });
  });

  describe("Failure Cases", function () {
    it("non owner cannot increment", async function () {
      await expect(counter.connect(other).increment()).to.be.revertedWith(
        "Not owner"
      );
    });

    it("non owner cannot decrement", async function () {
      await expect(counter.connect(other).decrement()).to.be.revertedWith(
        "Not owner"
      );
    });

    it("non owner cannot reset", async function () {
      await expect(counter.connect(other).reset()).to.be.revertedWith(
        "Not owner"
      );
    });

    it("decrement reverts when count is zero", async function () {
      await expect(counter.decrement()).to.be.revertedWith("Count is zero");
    });
  });

  describe("Events", function () {
    it("increment emits CountChanged event", async function () {
      await expect(counter.increment())
        .to.emit(counter, "CountChanged")
        .withArgs(owner.address, 1);
    });

    it("decrement emits CountChanged event", async function () {
      await counter.increment();
      await expect(counter.decrement())
        .to.emit(counter, "CountChanged")
        .withArgs(owner.address, 0);
    });

    it("reset emits CountChanged event", async function () {
      await counter.increment();
      await expect(counter.reset())
        .to.emit(counter, "CountChanged")
        .withArgs(owner.address, 0);
    });
  });
});
