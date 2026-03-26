pragma solidity ^0.8.20;

contract Voting {
    address public owner;
    mapping(uint256 => string) public candidates;
    mapping(uint256 => uint256) public votes;
    mapping(address => bool) public hasVoted;
    uint256 public candidateCount;
    bool public votingOpen;

    event VotingCreated(address owner);
    event CandidateAdded(uint256 candidateId, string name);
    event VotingStarted();
    event Voted(address voter, uint256 candidateId);
    event VotingStopped();
    event WinnerDeclared(uint256 winnerId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        votingOpen = false;
        candidateCount = 0;
        emit VotingCreated(msg.sender);
    }

    function addCandidate(string memory name) public onlyOwner {
        require(!votingOpen, "Voting already open");
        require(bytes(name).length > 0, "Empty name");
        candidateCount++;
        candidates[candidateCount] = name;
        votes[candidateCount] = 0;
        emit CandidateAdded(candidateCount, name);
    }

    function startVoting() public onlyOwner {
        require(candidateCount > 0, "No candidates");
        require(!votingOpen, "Already open");
        votingOpen = true;
        emit VotingStarted();
    }

    function vote(uint256 candidateId) public {
        require(votingOpen, "Voting closed");
        require(!hasVoted[msg.sender], "Already voted");
        require(candidateId > 0 && candidateId <= candidateCount, "Invalid candidate");
        hasVoted[msg.sender] = true;
        votes[candidateId]++;
        emit Voted(msg.sender, candidateId);
    }

    function stopVoting() public onlyOwner {
        require(votingOpen, "Already closed");
        votingOpen = false;
        emit VotingStopped();
    }

    function getVotes(uint256 candidateId) public view returns (uint256) {
        require(candidateId > 0 && candidateId <= candidateCount, "Invalid candidate");
        return votes[candidateId];
    }

    function getCandidate(uint256 candidateId) public view returns (string memory) {
        require(candidateId > 0 && candidateId <= candidateCount, "Invalid candidate");
        return candidates[candidateId];
    }

    function getWinner() public view returns (uint256) {
        require(!votingOpen, "Voting still open");
        require(candidateCount > 0, "No candidates");
        uint256 winningId = 1;
        uint256 winningVotes = votes[1];
        for (uint256 i = 2; i <= candidateCount; i++) {
            if (votes[i] > winningVotes) {
                winningVotes = votes[i];
                winningId = i;
            }
        }
        return winningId;
    }

    function declareWinner() public onlyOwner {
        require(!votingOpen, "Voting still open");
        require(candidateCount > 0, "No candidates");
        uint256 winnerId = getWinner();
        emit WinnerDeclared(winnerId);
    }
}