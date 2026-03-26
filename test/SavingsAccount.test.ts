import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("SavingsAccount", function () {
  async function deployFixture() {
    const [owner, other] = await hre.ethers.getSigners();
    const SavingsAccount = await hre.ethers.getContractFactory("SavingsAccount");
    const savingsAccount = await SavingsAccount.deploy();
    return { savingsAccount, owner, other };
  }

  describe("Happy Path", function () {
    it("deploy sets correct owner", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      expect(await savingsAccount.owner()).to.equal(owner.address);
    });

    it("deploy sets balance to 0", async function () {
      const { savingsAccount } = await loadFixture(deployFixture);
      expect(await savingsAccount.balance()).to.equal(0n);
    });

    it("deploy sets depositCount to 0", async function () {
      const { savingsAccount } = await loadFixture(deployFixture);
      expect(await savingsAccount.depositCount()).to.equal(0n);
    });

    it("anyone can deposit ETH", async function () {
      const { savingsAccount, other } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      await savingsAccount.connect(other).deposit({ value: amount });
      expect(await savingsAccount.balance()).to.equal(amount);
    });

    it("balance updates correctly after deposit", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("2.5");
      await savingsAccount.connect(owner).deposit({ value: amount });
      expect(await savingsAccount.balance()).to.equal(amount);
    });

    it("depositCount increments after deposit", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      await savingsAccount.connect(owner).deposit({ value: hre.ethers.parseEther("1.0") });
      expect(await savingsAccount.depositCount()).to.equal(1n);
    });

    it("multiple deposits work correctly", async function () {
      const { savingsAccount, owner, other } = await loadFixture(deployFixture);
      const amount1 = hre.ethers.parseEther("1.0");
      const amount2 = hre.ethers.parseEther("2.0");
      await savingsAccount.connect(owner).deposit({ value: amount1 });
      await savingsAccount.connect(other).deposit({ value: amount2 });
      expect(await savingsAccount.balance()).to.equal(amount1 + amount2);
      expect(await savingsAccount.depositCount()).to.equal(2n);
    });

    it("getBalance returns correct amount", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("3.0");
      await savingsAccount.connect(owner).deposit({ value: amount });
      expect(await savingsAccount.getBalance()).to.equal(amount);
    });

    it("getDepositCount returns correct count", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      await savingsAccount.connect(owner).deposit({ value: hre.ethers.parseEther("1.0") });
      await savingsAccount.connect(owner).deposit({ value: hre.ethers.parseEther("1.0") });
      expect(await savingsAccount.getDepositCount()).to.equal(2n);
    });

    it("owner can withdraw partial amount", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const depositAmount = hre.ethers.parseEther("5.0");
      const withdrawAmount = hre.ethers.parseEther("2.0");
      await savingsAccount.connect(owner).deposit({ value: depositAmount });
      await savingsAccount.connect(owner).withdraw(withdrawAmount);
      expect(await savingsAccount.balance()).to.equal(depositAmount - withdrawAmount);
    });

    it("balance updates correctly after withdraw", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const depositAmount = hre.ethers.parseEther("10.0");
      const withdrawAmount = hre.ethers.parseEther("4.0");
      await savingsAccount.connect(owner).deposit({ value: depositAmount });
      await savingsAccount.connect(owner).withdraw(withdrawAmount);
      expect(await savingsAccount.balance()).to.equal(depositAmount - withdrawAmount);
    });

    it("owner can withdraw full balance via withdrawAll", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("5.0");
      await savingsAccount.connect(owner).deposit({ value: amount });
      await savingsAccount.connect(owner).withdrawAll();
      expect(await savingsAccount.balance()).to.equal(0n);
    });

    it("balance is zero after withdrawAll", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      await savingsAccount.connect(owner).deposit({ value: hre.ethers.parseEther("3.0") });
      await savingsAccount.connect(owner).withdrawAll();
      expect(await savingsAccount.getBalance()).to.equal(0n);
    });

    it("owner receives correct ETH after withdraw", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const depositAmount = hre.ethers.parseEther("5.0");
      const withdrawAmount = hre.ethers.parseEther("2.0");
      await savingsAccount.connect(owner).deposit({ value: depositAmount });
      await expect(
        savingsAccount.connect(owner).withdraw(withdrawAmount)
      ).to.changeEtherBalance(owner, withdrawAmount);
    });

    it("owner receives correct ETH after withdrawAll", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const depositAmount = hre.ethers.parseEther("5.0");
      await savingsAccount.connect(owner).deposit({ value: depositAmount });
      await expect(
        savingsAccount.connect(owner).withdrawAll()
      ).to.changeEtherBalance(owner, depositAmount);
    });
  });

  describe("Events", function () {
    it("AccountCreated emitted on deploy", async function () {
      const [owner] = await hre.ethers.getSigners();
      const SavingsAccount = await hre.ethers.getContractFactory("SavingsAccount");
      const savingsAccount = await SavingsAccount.deploy();
      const receipt = await savingsAccount.deploymentTransaction()?.wait();

      const iface = new hre.ethers.Interface([
        "event AccountCreated(address owner)",
      ]);

      const event = receipt?.logs.find((log) => {
        try {
          return iface.parseLog(log as any)?.name === "AccountCreated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
    });

    it("Deposited emitted with correct args", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      await expect(savingsAccount.connect(owner).deposit({ value: amount }))
        .to.emit(savingsAccount, "Deposited")
        .withArgs(owner.address, amount, amount);
    });

    it("Withdrawn emitted with correct args for withdraw", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const depositAmount = hre.ethers.parseEther("5.0");
      const withdrawAmount = hre.ethers.parseEther("2.0");
      await savingsAccount.connect(owner).deposit({ value: depositAmount });
      await expect(savingsAccount.connect(owner).withdraw(withdrawAmount))
        .to.emit(savingsAccount, "Withdrawn")
        .withArgs(owner.address, withdrawAmount, depositAmount - withdrawAmount);
    });

    it("Withdrawn emitted with correct args for withdrawAll (balance = 0)", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      const depositAmount = hre.ethers.parseEther("3.0");
      await savingsAccount.connect(owner).deposit({ value: depositAmount });
      await expect(savingsAccount.connect(owner).withdrawAll())
        .to.emit(savingsAccount, "Withdrawn")
        .withArgs(owner.address, depositAmount, 0n);
    });
  });

  describe("Failure Cases", function () {
    it("zero deposit reverts with 'No ETH sent'", async function () {
      const { savingsAccount, other } = await loadFixture(deployFixture);
      await expect(
        savingsAccount.connect(other).deposit({ value: 0 })
      ).to.be.revertedWith("No ETH sent");
    });

    it("non owner cannot withdraw", async function () {
      const { savingsAccount, owner, other } = await loadFixture(deployFixture);
      await savingsAccount.connect(owner).deposit({ value: hre.ethers.parseEther("1.0") });
      await expect(
        savingsAccount.connect(other).withdraw(hre.ethers.parseEther("0.5"))
      ).to.be.revertedWith("Not owner");
    });

    it("zero amount withdraw reverts with 'Invalid amount'", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      await savingsAccount.connect(owner).deposit({ value: hre.ethers.parseEther("1.0") });
      await expect(
        savingsAccount.connect(owner).withdraw(0n)
      ).to.be.revertedWith("Invalid amount");
    });

    it("withdraw more than balance reverts with 'Insufficient balance'", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      await savingsAccount.connect(owner).deposit({ value: hre.ethers.parseEther("1.0") });
      await expect(
        savingsAccount.connect(owner).withdraw(hre.ethers.parseEther("5.0"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("non owner cannot withdrawAll", async function () {
      const { savingsAccount, owner, other } = await loadFixture(deployFixture);
      await savingsAccount.connect(owner).deposit({ value: hre.ethers.parseEther("1.0") });
      await expect(
        savingsAccount.connect(other).withdrawAll()
      ).to.be.revertedWith("Not owner");
    });

    it("withdrawAll with zero balance reverts with 'No balance'", async function () {
      const { savingsAccount, owner } = await loadFixture(deployFixture);
      await expect(
        savingsAccount.connect(owner).withdrawAll()
      ).to.be.revertedWith("No balance");
    });
  });
});
