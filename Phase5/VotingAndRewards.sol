// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Interface for RewardToken (ERC20)
 */
interface RewardToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title Voting & Reward System (light version with admin)
 */
contract VotingAndRewards {
    struct Review {
        address author;
        string content;
        uint256 timestampCreated;
        uint256 timestampModified;
        bool revoked;
        string[] editHistory;
        int256 netScore;
        mapping(address => int8) votes; // +1, -1 or 0
    }

    RewardToken public rewardToken;
    address public admin;

    uint256 public nextReviewId;
    mapping(uint256 => Review) public reviews;

    // Voting params
    mapping(address => bool) public isVerifiedBuyer;

    // Visibility params
    uint256 public alpha = 12; // alpha * 10 (example: 1.2 -> 12)

    // Reward params
    uint256 public mu = 2; // peak month
    uint256 public sigma = 1; // spread month
    uint256 public monthlyRewardPool = 10000 ether; // example: 10,000 tokens per month
    mapping(uint256 => mapping(uint256 => uint256)) public reviewRewards; // reviewId => month => tokens distributed

    uint256 public currentMonth;
    mapping(uint256 => uint256) public reviewPublishedMonth; // reviewId => month published

    event ReviewSubmitted(uint256 reviewId, address author);
    event ReviewRevoked(uint256 reviewId);
    event ReviewModified(uint256 reviewId);
    event Voted(uint256 reviewId, address voter, int8 voteWeight);
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
    function submitReview(string calldata content) external {
        uint256 reviewId = nextReviewId++;
        Review storage r = reviews[reviewId];
        r.author = msg.sender;
        r.content = content;
        r.timestampCreated = block.timestamp;
        r.timestampModified = block.timestamp;
        r.revoked = false;
        r.editHistory.push(content);
        r.netScore = 0;

        reviewPublishedMonth[reviewId] = currentMonth;

        emit ReviewSubmitted(reviewId, msg.sender);
    }

    /**
     * Vote review
     */
    function voteReview(uint256 reviewId, bool upvote) external {
        require(!reviews[reviewId].revoked, "Review revoked");

        Review storage r = reviews[reviewId];

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

        emit Voted(reviewId, msg.sender, newVote * weight);
    }

    /**
     * Revoke review
     */
    function revokeReview(uint256 reviewId) external {
        Review storage r = reviews[reviewId];
        require(r.author == msg.sender, "Only author");
        require(!r.revoked, "Already revoked");

        r.revoked = true;

        emit ReviewRevoked(reviewId);
    }

    /**
     * Modify review
     */
    function modifyReview(uint256 reviewId, string calldata newContent) external {
        Review storage r = reviews[reviewId];
        require(r.author == msg.sender, "Only author");
        require(!r.revoked, "Review revoked");

        r.content = newContent;
        r.timestampModified = block.timestamp;
        r.editHistory.push(newContent);

        // Reset votes
        r.netScore = 0;
        // Note: cleaning up votes mapping not implemented for simplicity

        emit ReviewModified(reviewId);
    }

    /**
     * Get visibility score
     */
    function getVisibilityScore(uint256 reviewId) external view returns (uint256) {
        Review storage r = reviews[reviewId];
        require(!r.revoked, "Review revoked");

        uint256 ageInMonths = currentMonth - reviewPublishedMonth[reviewId];

        uint256 denominator = (ageInMonths + 1) ** alpha / (10 ** alpha);

        uint256 visibilityScore = uint256(int256(r.netScore)) * (10 ** alpha) / denominator;

        return visibilityScore;
    }

    /**
     *
     Distribuire una quantità fissa di token (ad esempio 10.000 RVT) tra gli autori delle review più apprezzate
     (quelle con net score positivo), in proporzione a quanto la community le ha valutate utili, e in base all’età 
     della review. Ogni mese mintiamo nuovi token e li distribuiamo tra le review meritevoli.
     */
    
    function distributeRewards() external onlyAdmin {

        currentMonth++; // ogni volta che la funzione viene chiamata, incrementiamo il mese corrente

        uint256 totalWeight = 0;

        uint256[] memory weights = new uint256[](nextReviewId);


        // First pass: compute total W(j)
        for (uint256 i = 0; i < nextReviewId; i++) {
            Review storage r = reviews[i];
            if (r.revoked || r.netScore <= 0) continue;
            

            uint256 j = currentMonth - reviewPublishedMonth[i]; // months since published
            uint256 w = gaussianWeight(j);  // compute reward based on Gaussian function

            weights[i] = w;
            totalWeight += w;

        }

        // Second pass: distribute rewards
        for (uint256 i = 0; i < nextReviewId; i++) {
            if (weights[i] == 0) continue;

            uint256 tokens = (monthlyRewardPool * weights[i]) / totalWeight;
            reviewRewards[i][currentMonth] = tokens;
            

            // Mint tokens to author
            rewardToken.mint(reviews[i].author, tokens);
        }

        emit RewardsDistributed(currentMonth);
    }

    /**
     * Gaussian weight function wi(j)
     */
    function gaussianWeight(uint256 j) public view returns (uint256) {
        int256 num = int256(j) - int256(mu);
        int256 denom = int256(2 * sigma * sigma);

        int256 exponent = -((num * num) * 1e18) / denom;

        // Simplified placeholder for exp approximation
        if (j == mu) {
            return 1e18;
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
