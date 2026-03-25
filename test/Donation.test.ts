import { expect } from "chai";
import { ethers } from "hardhat";
import { Donation } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Donation", function () {
  let donation: Donation;
  let owner: SignerWithAddress;
  let donor1: SignerWithAddress;
  let donor2: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [owner, donor1, donor2, other] = await ethers.getSigners();

    const DonationFactory = await ethers.getContractFactory("Donation");
    donation = await DonationFactory.deploy();
    await donation.waitForDeployment(); // ✅ v6
  });

  describe("Happy Path", function () {
    it("deploy sets correct owner", async function () {
      const contractOwner = await donation.owner();
      expect(contractOwner).to.equal(owner.address);
    });

    it("deploy sets totalDonations to 0", async function () {
      const total = await donation.getTotalDonations();
      expect(total).to.equal(0);
    });

    it("anyone can donate ETH", async function () {
      const amount = ethers.parseEther("1.0");
      await donation.connect(donor1).donate({ value: amount });
      const donated = await donation.getDonation(donor1.address);
      expect(donated).to.equal(amount);
    });

    it("donations mapping updates correctly", async function () {
      const amount = ethers.parseEther("2.5");
      await donation.connect(donor1).donate({ value: amount });
      const donated = await donation.getDonation(donor1.address);
      expect(donated).to.equal(amount);
    });

    it("totalDonations updates correctly", async function () {
      const amount = ethers.parseEther("3.0");
      await donation.connect(donor1).donate({ value: amount });
      const total = await donation.getTotalDonations();
      expect(total).to.equal(amount);
    });

    it("getDonation returns correct amount", async function () {
      const amount = ethers.parseEther("1.5");
      await donation.connect(donor1).donate({ value: amount });
      const donated = await donation.getDonation(donor1.address);
      expect(donated).to.equal(amount);
    });

    it("getTotalDonations returns correct amount", async function () {
      const amount1 = ethers.parseEther("1.0");
      const amount2 = ethers.parseEther("2.0");

      await donation.connect(donor1).donate({ value: amount1 });
      await donation.connect(donor2).donate({ value: amount2 });

      const total = await donation.getTotalDonations();
      expect(total).to.equal(amount1 + amount2); // ✅ v6
    });

    it("multiple donors can donate", async function () {
      const amount1 = ethers.parseEther("1.0");
      const amount2 = ethers.parseEther("2.0");

      await donation.connect(donor1).donate({ value: amount1 });
      await donation.connect(donor2).donate({ value: amount2 });

      const donated1 = await donation.getDonation(donor1.address);
      const donated2 = await donation.getDonation(donor2.address);
      const total = await donation.getTotalDonations();

      expect(donated1).to.equal(amount1);
      expect(donated2).to.equal(amount2);
      expect(total).to.equal(amount1 + amount2); // ✅ v6
    });

    it("owner can withdraw full balance", async function () {
      const amount = ethers.parseEther("5.0");
      await donation.connect(donor1).donate({ value: amount });

      const balanceBefore = await owner.provider.getBalance(owner.address); // ✅ v6
      const tx = await donation.withdraw();
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice; // ✅ v6

      const balanceAfter = await owner.provider.getBalance(owner.address); // ✅ v6
      expect(balanceAfter).to.equal(balanceBefore + amount - gasCost); // ✅ v6
    });

    it("totalDonations resets to zero after withdraw", async function () {
      const amount = ethers.parseEther("3.0");
      await donation.connect(donor1).donate({ value: amount });

      await donation.withdraw();
      const total = await donation.getTotalDonations();
      expect(total).to.equal(0);
    });

    it("withdrawn event emitted correctly", async function () {
      const amount = ethers.parseEther("2.0");
      await donation.connect(donor1).donate({ value: amount });

      await expect(donation.withdraw())
        .to.emit(donation, "Withdrawn")
        .withArgs(owner.address, amount);
    });
  });

  describe("Failure Cases", function () {
    it("zero donation reverts", async function () {
      await expect(
        donation.connect(donor1).donate({ value: 0 }),
      ).to.be.revertedWith("No ETH sent");
    });

    it("non owner cannot withdraw", async function () {
      const amount = ethers.parseEther("1.0");
      await donation.connect(donor1).donate({ value: amount });

      await expect(donation.connect(other).withdraw()).to.be.revertedWith(
        "Not owner",
      );
    });

    it("withdraw with no donations reverts", async function () {
      await expect(donation.withdraw()).to.be.revertedWith("No donations");
    });
  });

  describe("Events", function () {
    it("constructor emits OwnerSet event", async function () {
      const DonationFactory = await ethers.getContractFactory("Donation");
      const receipt = await (await DonationFactory.deploy())
        .deploymentTransaction()
        ?.wait();

      const iface = new ethers.Interface(["event OwnerSet(address owner)"]);

      const event = receipt?.logs.find((log) => {
        try {
          return iface.parseLog(log as any)?.name === "OwnerSet";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
    });

    it("donate emits Donated event", async function () {
      const amount = ethers.parseEther("1.0");

      await expect(donation.connect(donor1).donate({ value: amount }))
        .to.emit(donation, "Donated")
        .withArgs(donor1.address, amount);
    });

    it("withdraw emits Withdrawn event", async function () {
      const amount = ethers.parseEther("2.0");
      await donation.connect(donor1).donate({ value: amount });

      await expect(donation.withdraw())
        .to.emit(donation, "Withdrawn")
        .withArgs(owner.address, amount);
    });
  });
});
