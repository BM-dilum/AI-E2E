import { expect } from "chai";
import { ethers } from "hardhat";
import { Voting } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Voting", function () {
  async function deployVotingFixture() {
    const [owner, voter1, voter2, voter3, nonOwner] = await ethers.getSigners();
    const VotingFactory = await ethers.getContractFactory("Voting");
    const voting = await VotingFactory.deploy();
    await voting.waitForDeployment();
    return { voting, owner, voter1, voter2, voter3, nonOwner };
  }

  async function deployWithCandidatesFixture() {
    const { voting, owner, voter1, voter2, voter3, nonOwner } =
      await deployVotingFixture();
    await voting.addCandidate("Alice");
    await voting.addCandidate("Bob");
    await voting.addCandidate("Charlie");
    return { voting, owner, voter1, voter2, voter3, nonOwner };
  }

  async function deployWithVotingOpenFixture() {
    const { voting, owner, voter1, voter2, voter3, nonOwner } =
      await deployWithCandidatesFixture();
    await voting.startVoting();
    return { voting, owner, voter1, voter2, voter3, nonOwner };
  }

  async function deployWithVotingClosedFixture() {
    const { voting, owner, voter1, voter2, voter3, nonOwner } =
      await deployWithVotingOpenFixture();
    await voting.connect(voter1).vote(1);
    await voting.connect(voter2).vote(1);
    await voting.connect(voter3).vote(2);
    await voting.stopVoting();
    return { voting, owner, voter1, voter2, voter3, nonOwner };
  }

  describe("Happy Path", function () {
    it("deploy sets correct owner", async function () {
      const { voting, owner } = await loadFixture(deployVotingFixture);
      expect(await voting.owner()).to.equal(owner.address);
    });

    it("deploy sets votingOpen to false", async function () {
      const { voting } = await loadFixture(deployVotingFixture);
      expect(await voting.votingOpen()).to.equal(false);
    });

    it("owner can add candidate", async function () {
      const { voting } = await loadFixture(deployVotingFixture);
      await voting.addCandidate("Alice");
      expect(await voting.candidateCount()).to.equal(1);
    });

    it("candidateCount increments after add", async function () {
      const { voting } = await loadFixture(deployVotingFixture);
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      expect(await voting.candidateCount()).to.equal(2);
    });

    it("getCandidate returns correct name", async function () {
      const { voting } = await loadFixture(deployVotingFixture);
      await voting.addCandidate("Alice");
      expect(await voting.getCandidate(1)).to.equal("Alice");
    });

    it("owner can start voting", async function () {
      const { voting } = await loadFixture(deployWithCandidatesFixture);
      await voting.startVoting();
      expect(await voting.votingOpen()).to.equal(true);
    });

    it("votingOpen is true after start", async function () {
      const { voting } = await loadFixture(deployWithCandidatesFixture);
      await voting.startVoting();
      expect(await voting.votingOpen()).to.equal(true);
    });

    it("voter can vote for valid candidate", async function () {
      const { voting, voter1 } = await loadFixture(deployWithVotingOpenFixture);
      await voting.connect(voter1).vote(1);
      expect(await voting.getVotes(1)).to.equal(1);
    });

    it("hasVoted is true after voting", async function () {
      const { voting, voter1 } = await loadFixture(deployWithVotingOpenFixture);
      await voting.connect(voter1).vote(1);
      expect(await voting.hasVoted(voter1.address)).to.equal(true);
    });

    it("getVotes returns correct count", async function () {
      const { voting, voter1, voter2 } = await loadFixture(
        deployWithVotingOpenFixture,
      );
      await voting.connect(voter1).vote(2);
      await voting.connect(voter2).vote(2);
      expect(await voting.getVotes(2)).to.equal(2);
    });

    it("multiple voters can vote", async function () {
      const { voting, voter1, voter2, voter3 } = await loadFixture(
        deployWithVotingOpenFixture,
      );
      await voting.connect(voter1).vote(1);
      await voting.connect(voter2).vote(2);
      await voting.connect(voter3).vote(1);
      expect(await voting.getVotes(1)).to.equal(2);
      expect(await voting.getVotes(2)).to.equal(1);
    });

    it("owner can stop voting", async function () {
      const { voting } = await loadFixture(deployWithVotingOpenFixture);
      await voting.stopVoting();
      expect(await voting.votingOpen()).to.equal(false);
    });

    it("votingOpen is false after stop", async function () {
      const { voting } = await loadFixture(deployWithVotingOpenFixture);
      await voting.stopVoting();
      expect(await voting.votingOpen()).to.equal(false);
    });

    it("getWinner returns candidate with most votes", async function () {
      const { voting } = await loadFixture(deployWithVotingClosedFixture);
      // voter1 and voter2 voted for candidate 1 (Alice), voter3 voted for candidate 2 (Bob)
      const winner = await voting.getWinner();
      expect(winner).to.equal(1);
    });

    it("VotingCreated event emitted on deploy", async function () {
      const [owner] = await ethers.getSigners();
      const VotingFactory = await ethers.getContractFactory("Voting");
      const voting = await VotingFactory.deploy();
      const receipt = await voting.deploymentTransaction()?.wait();

      const iface = new ethers.Interface([
        "event VotingCreated(address owner)",
      ]);
      const event = receipt?.logs.find((log) => {
        try {
          return iface.parseLog(log as any)?.name === "VotingCreated";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("CandidateAdded event emitted", async function () {
      const { voting } = await loadFixture(deployVotingFixture);
      await expect(voting.addCandidate("Alice"))
        .to.emit(voting, "CandidateAdded")
        .withArgs(1, "Alice");
    });

    it("VotingStarted event emitted", async function () {
      const { voting } = await loadFixture(deployWithCandidatesFixture);
      await expect(voting.startVoting()).to.emit(voting, "VotingStarted");
    });

    it("Voted event emitted", async function () {
      const { voting, voter1 } = await loadFixture(deployWithVotingOpenFixture);
      await expect(voting.connect(voter1).vote(1))
        .to.emit(voting, "Voted")
        .withArgs(voter1.address, 1);
    });

    it("VotingStopped event emitted", async function () {
      const { voting } = await loadFixture(deployWithVotingOpenFixture);
      await expect(voting.stopVoting()).to.emit(voting, "VotingStopped");
    });
  });

  describe("Failure Cases", function () {
    it("non owner cannot add candidate", async function () {
      const { voting, nonOwner } = await loadFixture(deployVotingFixture);
      await expect(
        voting.connect(nonOwner).addCandidate("Alice"),
      ).to.be.revertedWith("Not owner");
    });

    it("empty candidate name reverts", async function () {
      const { voting } = await loadFixture(deployVotingFixture);
      await expect(voting.addCandidate("")).to.be.revertedWith("Empty name");
    });

    it("cannot add candidate after voting starts", async function () {
      const { voting } = await loadFixture(deployWithVotingOpenFixture);
      await expect(voting.addCandidate("Dave")).to.be.revertedWith(
        "Voting already open",
      );
    });

    it("cannot start voting with no candidates", async function () {
      const { voting } = await loadFixture(deployVotingFixture);
      await expect(voting.startVoting()).to.be.revertedWith("No candidates");
    });

    it("cannot start voting twice", async function () {
      const { voting } = await loadFixture(deployWithVotingOpenFixture);
      await expect(voting.startVoting()).to.be.revertedWith("Already open");
    });

    it("cannot vote when voting closed", async function () {
      const { voting, voter1 } = await loadFixture(deployWithCandidatesFixture);
      await expect(voting.connect(voter1).vote(1)).to.be.revertedWith(
        "Voting closed",
      );
    });

    it("cannot vote twice", async function () {
      const { voting, voter1 } = await loadFixture(deployWithVotingOpenFixture);
      await voting.connect(voter1).vote(1);
      await expect(voting.connect(voter1).vote(1)).to.be.revertedWith(
        "Already voted",
      );
    });

    it("cannot vote for invalid candidate", async function () {
      const { voting, voter1 } = await loadFixture(deployWithVotingOpenFixture);
      await expect(voting.connect(voter1).vote(99)).to.be.revertedWith(
        "Invalid candidate",
      );
    });

    it("non owner cannot stop voting", async function () {
      const { voting, nonOwner } = await loadFixture(
        deployWithVotingOpenFixture,
      );
      await expect(voting.connect(nonOwner).stopVoting()).to.be.revertedWith(
        "Not owner",
      );
    });

    it("cannot stop voting when already closed", async function () {
      const { voting } = await loadFixture(deployWithCandidatesFixture);
      await expect(voting.stopVoting()).to.be.revertedWith("Already closed");
    });

    it("getWinner reverts when voting still open", async function () {
      const { voting } = await loadFixture(deployWithVotingOpenFixture);
      await expect(voting.getWinner()).to.be.revertedWith("Voting still open");
    });
  });
});
