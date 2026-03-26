import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("MessageBoard", function () {
  async function deployFixture() {
    const [owner, other] = await hre.ethers.getSigners();
    const MessageBoard = await hre.ethers.getContractFactory("MessageBoard");
    const messageBoard = await MessageBoard.deploy();
    return { messageBoard, owner, other };
  }

  describe("Happy Path", function () {
    it("deploy sets correct owner", async function () {
      const { messageBoard, owner } = await loadFixture(deployFixture);
      expect(await messageBoard.owner()).to.equal(owner.address);
    });

    it("anyone can post a message", async function () {
      const { messageBoard, other } = await loadFixture(deployFixture);
      await messageBoard.connect(other).postMessage("Hello from other");
      expect(await messageBoard.getMessage()).to.equal("Hello from other");
    });

    it("getMessage returns correct message", async function () {
      const { messageBoard } = await loadFixture(deployFixture);
      await messageBoard.postMessage("Test message");
      expect(await messageBoard.getMessage()).to.equal("Test message");
    });

    it("messageCount increments after post", async function () {
      const { messageBoard } = await loadFixture(deployFixture);
      await messageBoard.postMessage("First");
      expect(await messageBoard.messageCount()).to.equal(1);
      await messageBoard.postMessage("Second");
      expect(await messageBoard.messageCount()).to.equal(2);
    });

    it("getMessageCount returns correct count", async function () {
      const { messageBoard } = await loadFixture(deployFixture);
      await messageBoard.postMessage("One");
      await messageBoard.postMessage("Two");
      await messageBoard.postMessage("Three");
      expect(await messageBoard.getMessageCount()).to.equal(3);
    });

    it("owner can clear message", async function () {
      const { messageBoard, owner } = await loadFixture(deployFixture);
      await messageBoard.postMessage("To be cleared");
      await messageBoard.connect(owner).clearMessage();
      expect(await messageBoard.getMessage()).to.equal("");
    });

    it("message is empty string after clear", async function () {
      const { messageBoard } = await loadFixture(deployFixture);
      await messageBoard.postMessage("Some message");
      await messageBoard.clearMessage();
      expect(await messageBoard.getMessage()).to.equal("");
    });

    it("messageCount is 0 after clear", async function () {
      const { messageBoard } = await loadFixture(deployFixture);
      await messageBoard.postMessage("First");
      await messageBoard.postMessage("Second");
      await messageBoard.clearMessage();
      expect(await messageBoard.messageCount()).to.equal(0);
    });

    it("MessagePosted event emitted with correct args", async function () {
      const { messageBoard, owner } = await loadFixture(deployFixture);
      await expect(messageBoard.connect(owner).postMessage("Event test"))
        .to.emit(messageBoard, "MessagePosted")
        .withArgs(owner.address, "Event test");
    });

    it("MessageCleared event emitted with correct args", async function () {
      const { messageBoard, owner } = await loadFixture(deployFixture);
      await messageBoard.postMessage("Will be cleared");
      await expect(messageBoard.connect(owner).clearMessage())
        .to.emit(messageBoard, "MessageCleared")
        .withArgs(owner.address);
    });
  });

  describe("Failure Cases", function () {
    it("non owner cannot clear message", async function () {
      const { messageBoard, other } = await loadFixture(deployFixture);
      await messageBoard.postMessage("Some message");
      await expect(
        messageBoard.connect(other).clearMessage()
      ).to.be.revertedWith("Not owner");
    });
  });
});
