import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("TokenLocker", function () {
  async function deployFixture() {
    const [owner, other] = await hre.ethers.getSigners();
    const TokenLocker = await hre.ethers.getContractFactory("TokenLocker");
    const tokenLocker = await TokenLocker.deploy();
    await tokenLocker.deployed();
    return { tokenLocker, owner, other };
  }

  describe("Happy Path", function () {
    it("deploy sets correct owner", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      expect(await tokenLocker.owner()).to.equal(owner.address);
    });

    it("deploy sets isLocked to false", async function () {
      const { tokenLocker } = await loadFixture(deployFixture);
      expect(await tokenLocker.isLocked()).to.equal(false);
    });

    it("deploy sets lockedAmount to 0", async function () {
      const { tokenLocker } = await loadFixture(deployFixture);
      expect(await tokenLocker.lockedAmount()).to.equal(0);
    });

    it("owner can lock ETH with duration", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600; // 1 hour
      await tokenLocker.connect(owner).lock(duration, { value: amount });
      expect(await tokenLocker.isLocked()).to.equal(true);
    });

    it("isLocked is true after lock", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      await tokenLocker.connect(owner).lock(3600, { value: amount });
      expect(await tokenLocker.isLocked()).to.equal(true);
    });

    it("lockedAmount is correct after lock", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      await tokenLocker.connect(owner).lock(3600, { value: amount });
      expect(await tokenLocker.lockedAmount()).to.equal(amount);
    });

    it("getLockedAmount returns correct amount", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("2.5");
      await tokenLocker.connect(owner).lock(3600, { value: amount });
      expect(await tokenLocker.getLockedAmount()).to.equal(amount);
    });

    it("getTimeRemaining returns correct time when locked", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600;
      await tokenLocker.connect(owner).lock(duration, { value: amount });
      const timeRemaining = await tokenLocker.getTimeRemaining();
      expect(timeRemaining).to.be.gt(0);
    });

    it("getTimeRemaining returns 0 when not locked", async function () {
      const { tokenLocker } = await loadFixture(deployFixture);
      expect(await tokenLocker.getTimeRemaining()).to.equal(0);
    });

    it("owner can unlock after duration passes", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600;
      await tokenLocker.connect(owner).lock(duration, { value: amount });
      await time.increase(duration + 1);
      await tokenLocker.connect(owner).unlock();
      expect(await tokenLocker.isLocked()).to.equal(false);
    });

    it("isLocked is false after unlock", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600;
      await tokenLocker.connect(owner).lock(duration, { value: amount });
      await time.increase(duration + 1);
      await tokenLocker.connect(owner).unlock();
      expect(await tokenLocker.isLocked()).to.equal(false);
    });

    it("lockedAmount is 0 after unlock", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600;
      await tokenLocker.connect(owner).lock(duration, { value: amount });
      await time.increase(duration + 1);
      await tokenLocker.connect(owner).unlock();
      expect(await tokenLocker.lockedAmount()).to.equal(0);
    });

    it("owner receives full balance after unlock", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600;
      await tokenLocker.connect(owner).lock(duration, { value: amount });
      await time.increase(duration + 1);
      await expect(
        tokenLocker.connect(owner).unlock()
      ).to.changeEtherBalance(owner, amount);
    });

    it("constructor emits OwnerSet event", async function () {
      const [owner] = await hre.ethers.getSigners();
      const TokenLocker = await hre.ethers.getContractFactory("TokenLocker");
      const deployTx = await TokenLocker.deploy();
      const receipt = await deployTx.wait();

      const iface = new hre.ethers.Interface(["event OwnerSet(address owner)"]);
      const event = receipt?.logs.find((log) => {
        try {
          return iface.parseLog(log as any)?.name === "OwnerSet";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("lock emits Locked event", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600;
      const tx = await tokenLocker.connect(owner).lock(duration, { value: amount });
      const receipt = await tx.wait();
      const expectedUnlockTime = await tokenLocker.unlockTime();
      await expect(
        tokenLocker.connect(owner).lock(duration, { value: amount })
      ).to.be.revertedWith("Already locked");
      // Verify the event was emitted during the first lock
      const iface = new hre.ethers.Interface([
        "event Locked(address owner, uint256 amount, uint256 unlockTime)",
      ]);
      const event = receipt?.logs.find((log) => {
        try {
          return iface.parseLog(log as any)?.name === "Locked";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("unlock emits Unlocked event", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600;
      await tokenLocker.connect(owner).lock(duration, { value: amount });
      await time.increase(duration + 1);
      await expect(tokenLocker.connect(owner).unlock())
        .to.emit(tokenLocker, "Unlocked")
        .withArgs(owner.address, amount);
    });
  });

  describe("Failure Cases", function () {
    it("non owner cannot lock", async function () {
      const { tokenLocker, other } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      await expect(
        tokenLocker.connect(other).lock(3600, { value: amount })
      ).to.be.revertedWith("Not owner");
    });

    it("zero ETH lock reverts", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      await expect(
        tokenLocker.connect(owner).lock(3600, { value: 0 })
      ).to.be.revertedWith("No ETH sent");
    });

    it("zero duration lock reverts", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      await expect(
        tokenLocker.connect(owner).lock(0, { value: amount })
      ).to.be.revertedWith("Invalid duration");
    });

    it("cannot lock when already locked", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      await tokenLocker.connect(owner).lock(3600, { value: amount });
      await expect(
        tokenLocker.connect(owner).lock(3600, { value: amount })
      ).to.be.revertedWith("Already locked");
    });

    it("non owner cannot unlock", async function () {
      const { tokenLocker, owner, other } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600;
      await tokenLocker.connect(owner).lock(duration, { value: amount });
      await time.increase(duration + 1);
      await expect(
        tokenLocker.connect(other).unlock()
      ).to.be.revertedWith("Not owner");
    });

    it("cannot unlock when not locked", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      await expect(
        tokenLocker.connect(owner).unlock()
      ).to.be.revertedWith("Not locked");
    });

    it("cannot unlock before duration passes", async function () {
      const { tokenLocker, owner } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");
      const duration = 3600;
      await tokenLocker.connect(owner).lock(duration, { value: amount });
      await expect(
        tokenLocker.connect(owner).unlock()
      ).to.be.revertedWith("Still locked");
    });
  });
});