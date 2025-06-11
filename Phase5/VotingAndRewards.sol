// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./RewardToken.sol";

/**
 * @title Voting & Reward System (light version with admin)
 *
 */
contract VotingAndRewards {
    struct Review {
        address author;
        string ipfsCID;       
        address shop;   
        uint256 timestamp;
        bool revoked;
        int256 netScore;
        mapping(address => int8) votes; // +1, -1 or 0
    }

    RewardToken public rewardToken;
    address public admin;

    uint256 public nextnftId;
    mapping(uint256 => Review) public reviews;

    // Voting params
    mapping(address => bool) public isVerifiedBuyer;

    // Visibility params
    uint256 public alpha = 12; // alpha * 10 (example: 1.2 -> 12)

    // Reward params
    uint256 public mu = 2; // peak month
    uint256 public sigma = 1; // spread month
    uint256 public monthlyRewardPool = 10000 ether; // example: 10,000 tokens per month
    mapping(uint256 => mapping(uint256 => uint256)) public reviewRewards; // nftId => month => tokens distributed

    uint256 public currentMonth;
    mapping(uint256 => uint256) public reviewPublishedMonth; // nftId => month published

    event ReviewSubmitted(uint256 nftId, address author);
    event ReviewRevoked(uint256 nftId);
    event ReviewModified(uint256 nftId);
    event Voted(uint256 nftId, address voter, int8 voteWeight);
    event RewardsDistributed(uint256 month);


    constructor(address _rewardToken) {
        rewardToken = RewardToken(_rewardToken);
        admin = msg.sender;
    }

    /**
     * Admin only modifier replacement
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    /**
     * Change admin
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    /**
     * Simulated method to set buyer verification (in real system -> check NFT elsewhere)
     */
    function setVerifiedBuyer(address user, bool status) external onlyAdmin {
        isVerifiedBuyer[user] = status;
    }



    // Queste cose submitReview modifyReview andrebbero fatte nella fase 4 con reset del netscore ecc.

    /**
     * Submit review
     */
    function submitReview(uint256 nftId, address submittedShop, string memory _cid) external {
        
        Review storage r = reviews[nftId];
        r.author = msg.sender;
        r.ipfsCID = _cid;
        r.shop = submittedShop;
        r.timestamp = block.timestamp;
        r.revoked = false;
        r.netScore = 0;

        reviewPublishedMonth[nftId] = currentMonth;

        emit ReviewSubmitted(nftId, msg.sender);
    }


    /**
     * Vote review
     */
    function voteReview(uint256 nftId, bool upvote) external {
        require(!reviews[nftId].revoked, "Review revoked");

        Review storage r = reviews[nftId];

        int8 previousVote = r.votes[msg.sender];
        int8 newVote = upvote ? int8(1) : int8(-1);

        require(previousVote != newVote, "Same vote already cast");

        // Weight
        int8 weight = isVerifiedBuyer[msg.sender] ? int8(2) : int8(1);

        // Remove old vote if any
        r.netScore -= int256(previousVote) * int256(weight);

        // Set new vote
        r.votes[msg.sender] = newVote;

        // Add new vote
        r.netScore += int256(newVote) * int256(weight);

        emit Voted(nftId, msg.sender, newVote * weight);
    }

    /**
     * Revoke review
     */
    function revokeReview(uint256 nftId) external {
        Review storage r = reviews[nftId];
        require(r.author == msg.sender, "Only author");
        require(!r.revoked, "Already revoked");

        r.ipfsCID = "";
        r.shop = address(0);
        r.timestamp = 0;
        r.revoked = true;
        r.netScore = 0;


        emit ReviewRevoked(nftId);
    }

    /**
     * Modify review
     */
    function modifyReview(uint256 nftId, string memory newCID) external {
        Review storage r = reviews[nftId];
        require(r.author == msg.sender, "Only author");
        require(!r.revoked, "Review revoked");

        r.timestamp = block.timestamp;
        r.ipfsCID = newCID;

        // Reset votes
        r.netScore = 0;
        // Note: cleaning up votes mapping not implemented for simplicity

        emit ReviewModified(nftId);
    }

    /**
     * Get visibility score
     */
    function getVisibilityScore(uint256 nftId) external view returns (uint256) {
    Review storage r = reviews[nftId];
    require(!r.revoked, "Review revoked");

    uint256 ageInMonths = currentMonth - reviewPublishedMonth[nftId];

    // Simplified denominator to avoid overflow
    // You can tune this formula as you like, here it's linear decay
    uint256 denom = (ageInMonths + 1);

    // Protect against negative netScore (negative scores → 0 visibility)
    int256 netScoreInt = r.netScore;
    uint256 netScoreAbs = netScoreInt >= 0 ? uint256(netScoreInt) : 0;

    // Compute visibility score with a scaling factor (1e18 for precision)
    uint256 visibilityScore = (netScoreAbs * 1e18) / denom;

    return visibilityScore;
}


    /**
     *
     Distribuire una quantità fissa di token (ad esempio 10.000 RVT) tra gli autori delle review più apprezzate
     (quelle con net score positivo), in proporzione a quanto la community le ha valutate utili, e in base all’età 
     della review. Ogni mese mintiamo nuovi token e li distribuiamo tra le review meritevoli.
     */
    
   function distributeRewards() external onlyAdmin {
    currentMonth++;

    uint256 rewardPool = rewardToken.balanceOf(address(this)); // TESORERIA → usa i token che il contratto possiede

    // Protect: if rewardPool == 0, skip distribution
    if (rewardPool == 0) {
        emit RewardsDistributed(currentMonth);
        return;
    }

    uint256 totalWeight = 0;
    uint256[] memory weights = new uint256[](nextnftId);

    // First pass: compute total W(j)
    for (uint256 i = 0; i < nextnftId; i++) {
        Review storage r = reviews[i];
        if (r.revoked || r.netScore <= 0) continue;

        uint256 j = currentMonth - reviewPublishedMonth[i];
        uint256 w = gaussianWeight(j);

        // Protect against potential weight overflow (clamp max value if needed)
        if (w > 1e18) {
            w = 1e18; // max weight cap
        }

        weights[i] = w;
        totalWeight += w;

    }

    // Protect: if totalWeight == 0, skip distribution to avoid division by zero
    if (totalWeight == 0) {
        emit RewardsDistributed(currentMonth);
        return;
    }

    // Second pass: distribute rewards
    for (uint256 i = 0; i < nextnftId; i++) {
        if (weights[i] == 0) continue;

        uint256 tokens = (rewardPool * weights[i]) / totalWeight;
        reviewRewards[i][currentMonth] = tokens;

        // Skip transferring 0 tokens to avoid ERC20 revert
        if (tokens == 0) continue;

        rewardToken.transfer(reviews[i].author, tokens); // QUI il transfer effettivo (tesoreria)
    }

    emit RewardsDistributed(currentMonth);
}


    /**
     * Gaussian weight function wi(j)
     */
    function gaussianWeight(uint256 j) public view returns (uint256) {
    int256 num = int256(j) - int256(mu);

    // Simplified placeholder for exp approximation (no real exp)

    if (j == mu) {
        return 1e18; // massimo peso
    } else {
        return uint256(1e18 / (uint256((num * num) + 1)));
    }
}

    /**
     * Admin set params
     */
    function setAlpha(uint256 _alpha) external onlyAdmin {
        alpha = _alpha;
    }

    function setMu(uint256 _mu) external onlyAdmin {
        mu = _mu;
    }

    function setSigma(uint256 _sigma) external onlyAdmin {
        sigma = _sigma;
    }

    function setMonthlyRewardPool(uint256 _amount) external onlyAdmin {
        monthlyRewardPool = _amount;
    }
}
