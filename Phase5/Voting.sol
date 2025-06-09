// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IProofOfPurchaseNFT {
    function balanceOf(address owner) external view returns (uint256);
}

contract Voting {

    // Address of the Proof of Purchase NFT contract
    IProofOfPurchaseNFT public proofOfPurchaseNFT;

    // Owner of the contract
    address public owner;

    // Review structure: each review has an aggregate score
    struct ReviewVotes {
        int256 netScore; // sum of weighted votes
        mapping(address => int8) voterVotes; // to track individual voter's previous vote (+1 or -1)
    }

    // Mapping reviewId → votes
    mapping(uint256 => ReviewVotes) private reviews;

    // Events
    event VoteCast(address indexed voter, uint256 indexed reviewId, int8 voteValue, uint8 weight, int256 newNetScore);

    // Constructor: set NFT contract address
    constructor(address _proofOfPurchaseNFT) {
        owner = msg.sender;
        proofOfPurchaseNFT = IProofOfPurchaseNFT(_proofOfPurchaseNFT);
    }

    /**
     * Vote on a review.
     * @param reviewId ID of the review.
     * @param isUpvote true = upvote, false = downvote.
     */
    function vote(uint256 reviewId, bool isUpvote) external {
        ReviewVotes storage review = reviews[reviewId];

        // Determine voter's weight
        uint8 weight = _getVoteWeight(msg.sender);

        // Map bool to signed vote (+1 / -1)
        int8 voteValue = isUpvote ? int8(1) : int8(-1);

        // Check if user already voted
        int8 previousVote = review.voterVotes[msg.sender];

        // If the user is changing their vote:
        if (previousVote != 0) {
            // Subtract the previous weighted vote
            review.netScore -= int256(previousVote) * int256(uint256(weight));


        }

        // Record the new vote
        review.voterVotes[msg.sender] = voteValue;

        // Add the new weighted vote
        review.netScore += int256(voteValue) * int256(uint256(weight));

        emit VoteCast(msg.sender, reviewId, voteValue, weight, review.netScore);
    }

    /**
     * View current net score of a review.
     */
    function getReviewNetScore(uint256 reviewId) external view returns (int256) {
        return reviews[reviewId].netScore;
    }

    /**
     * View whether the caller has already voted and with what value.
     */
    function getMyVote(uint256 reviewId) external view returns (int8) {
        return reviews[reviewId].voterVotes[msg.sender];
    }

    /**
     * Internal function to determine weight of voter.
     */
    function _getVoteWeight(address voter) internal view returns (uint8) {
        // If user holds at least 1 proof-of-purchase NFT → weight = 2
        if (proofOfPurchaseNFT.balanceOf(voter) > 0) {
            return 2;
        }
        // Else → weight = 1
        return 1;
    }
}
