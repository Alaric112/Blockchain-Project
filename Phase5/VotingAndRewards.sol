// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./RewardToken.sol";

/**
 * @title Voting & Reward System
 * Contratto per la gestione di recensioni, votazioni pesate e distribuzione di ricompense mensili.
 */
contract VotingAndRewards {
    struct Review {
        address author;         // Autore della review
        string content;         // Contenuto (testo o CID IPFS) della review
        uint256 timestamp;      // Timestamp di pubblicazione o modifica
        bool revoked;           // Flag di revoca della review
        int256 netScore;        // Net score (somma pesata dei voti)
        mapping(address => int8) votes; // Mappatura dei voti per utente (+1, -1 o 0)
    }

    struct ReviewWeight {
        uint256 reviewId;
        uint256 weight;
    }

    RewardToken public rewardToken;      // Token utilizzato per le ricompense
    address public admin;               // Amministratore del contratto

    uint256 public nextnftId;           // ID progressivo per le recensioni
    mapping(uint256 => Review) public reviews; // Mappatura ID recensione -> Review

    // Parametri per votazione
    mapping(address => bool) public isVerifiedBuyer; // Utenti verificati (weight=2)

    // Parametri per visibilità (non usati attualmente nel calcolo ricompense)
    uint256 public alpha = 12;          // coefficiente di visibilità (non utilizzato nel codice corrente)

    // Parametri per ricompense
    uint256 public mu = 2;              // Mese di picco (curva gaussiana)
    uint256 public sigma = 1;           // Deviazione (curva gaussiana) - non usato nella funzione attuale
    uint256 public monthlyRewardPool = 10000 ether; // Pool fittizio di ricompense mensili
    uint256 public topK = 10;           // Numero massimo di recensioni premiate (Top K)
    mapping(uint256 => mapping(uint256 => uint256)) public reviewRewards; // reviewId => month => token distribuiti

    uint256 public currentMonth;        // Mese attuale (incrementato ad ogni distribuzione)
    mapping(uint256 => uint256) public reviewPublishedMonth; // reviewId => mese di pubblicazione

    // Eventi per notifiche di azioni sul contratto
    event ReviewSubmitted(uint256 reviewId, address author);
    event ReviewRevoked(uint256 reviewId);
    event ReviewModified(uint256 reviewId);
    event Voted(uint256 reviewId, address voter, int8 voteWeight);
    event RewardsDistributed(uint256 month);

    /**
     * @dev Inizializza il contratto impostando il token RewardToken e l'admin.
     */
    constructor(address _rewardToken) {
        rewardToken = RewardToken(_rewardToken);
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    /**
     * @dev Trasferisce il ruolo di admin a un nuovo indirizzo.
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    /**
     * @dev Imposta lo status di verified buyer per un utente (funzione dell'admin).
     */
    function setVerifiedBuyer(address user, bool status) external onlyAdmin {
        isVerifiedBuyer[user] = status;
    }

    /**
     * @dev Pubblica una nuova recensione. Viene assegnato un ID univoco in modo incrementale.
     * @param _content Contenuto (testo o CID IPFS) della recensione.
     */
    function submitReview(string memory _content) external {
        uint256 reviewId = nextnftId;
        Review storage r = reviews[reviewId];
        r.author = msg.sender;
        r.content = _content;
        r.timestamp = block.timestamp;
        r.revoked = false;
        r.netScore = 0;

        // Memorizza il mese di pubblicazione corrente
        reviewPublishedMonth[reviewId] = currentMonth;

        emit ReviewSubmitted(reviewId, msg.sender);
        nextnftId++;
    }

    /**
     * @dev Vota una recensione. Voto pesato: 2 o -2 se verified, altrimenti 1 o -1.
     * Requisiti: non si può votare più volte con lo stesso segno.
     * @param reviewId ID della recensione da votare.
     * @param upvote true per voto positivo, false per negativo.
     */
    function voteReview(uint256 reviewId, bool upvote) external {
        require(!reviews[reviewId].revoked, "Review revoked");

        Review storage r = reviews[reviewId];
        int8 previousVote = r.votes[msg.sender];
        int8 newVote = upvote ? int8(1) : int8(-1);

        require(previousVote != newVote, "Same vote already cast");

        int8 weight = isVerifiedBuyer[msg.sender] ? int8(2) : int8(1);

        // Rimuovi l'effetto del vecchio voto dal netScore
        r.netScore -= int256(previousVote) * int256(weight);

        // Registra il nuovo voto
        r.votes[msg.sender] = newVote;
        r.netScore += int256(newVote) * int256(weight);

        emit Voted(reviewId, msg.sender, newVote * weight);
    }

    /**
     * @dev Revoca (rimuove) una recensione. Solo l'autore può revocare.
     * Azzera il contenuto e lo score.
     * @param reviewId ID della recensione da revocare.
     */
    function revokeReview(uint256 reviewId) external {
        Review storage r = reviews[reviewId];
        require(r.author == msg.sender, "Only author");
        require(!r.revoked, "Already revoked");

        r.content = "";
        r.timestamp = 0;
        r.revoked = true;
        r.netScore = 0;

        emit ReviewRevoked(reviewId);
    }

    /**
     * @dev Modifica il contenuto di una recensione. Solo l'autore può modificare.
     * La modifica azzera il netScore della recensione.
     * @param reviewId ID della recensione da modificare.
     * @param newContent Nuovo contenuto della recensione.
     */
    function modifyReview(uint256 reviewId, string memory newContent) external {
        Review storage r = reviews[reviewId];
        require(r.author == msg.sender, "Only author");
        require(!r.revoked, "Review revoked");

        r.timestamp = block.timestamp;
        r.content = newContent;
        r.netScore = 0; // Resetta lo score (i vecchi voti vengono ignorati)

        emit ReviewModified(reviewId);
    }

    /**
     * @dev Calcola un punteggio di visibilità basato sul netScore e sull'età della recensione.
     * Usato internamente; restituisce 0 se la review è revocata o negativa.
     * @param reviewId ID della recensione.
     * @return visibilityScore Punteggio di visibilità (uint).
     */
    function getVisibilityScore(uint256 reviewId) external view returns (uint256) {
        Review storage r = reviews[reviewId];
        require(!r.revoked, "Review revoked");

        uint256 ageInMonths = currentMonth - reviewPublishedMonth[reviewId];
        uint256 denom = ageInMonths + 1;

        // Se netScore è negativo, consideriamo 0
        int256 netScoreInt = r.netScore;
        uint256 netScoreAbs = netScoreInt >= 0 ? uint256(netScoreInt) : 0;

        // Punteggio di visibilità con fattore di scala 1e18
        uint256 visibilityScore = (netScoreAbs * 1e18) / denom;
        return visibilityScore;
    }

    /**
     * @dev Distribuisce i token di ricompensa ai Top K autori di recensioni con netScore > 0.
     * Calcola i pesi usando una curva gaussiana (funzione gaussianWeight).
     * Distribuisce proporzionalmente i token dal balance del contratto.
     */
    function distributeRewards() external onlyAdmin {
        currentMonth++;

        uint256 rewardPool = rewardToken.balanceOf(address(this));
        if (rewardPool == 0) {
            emit RewardsDistributed(currentMonth);
            return;
        }

        // Trova le Top K recensioni con netScore positivo usando un min-heap
        ReviewWeight[] memory topKReviews = new ReviewWeight[](topK);
        uint256 heapSize = 0;

        for (uint256 i = 0; i < nextnftId; i++) {
            Review storage r = reviews[i];
            if (r.revoked || r.netScore <= 0) continue;

            uint256 j = currentMonth - reviewPublishedMonth[i];
            uint256 w = gaussianWeight(j);
            if (w > 1e18) w = 1e18;
            if (w == 0) continue;

            if (heapSize < topK) {
                // Aggiungi elemento alla heap
                topKReviews[heapSize] = ReviewWeight(i, w);
                heapSize++;
                _heapifyUp(topKReviews, heapSize - 1);
            } else if (w > topKReviews[0].weight) {
                // Sostituisci il min se il peso corrente è maggiore
                topKReviews[0] = ReviewWeight(i, w);
                _heapifyDown(topKReviews, 0, heapSize);
            }
        }

        if (heapSize == 0) {
            emit RewardsDistributed(currentMonth);
            return;
        }

        // Calcola somma dei pesi totali
        uint256 totalWeight = 0;
        for (uint256 k = 0; k < heapSize; k++) {
            totalWeight += topKReviews[k].weight;
        }
        if (totalWeight == 0) {
            emit RewardsDistributed(currentMonth);
            return;
        }

        // Distribuisci token in base ai pesi relativi
        for (uint256 k = 0; k < heapSize; k++) {
            uint256 rid = topKReviews[k].reviewId;
            uint256 weight = topKReviews[k].weight;

            uint256 tokens = (rewardPool * weight) / totalWeight;
            reviewRewards[rid][currentMonth] = tokens;
            if (tokens == 0) continue;

            rewardToken.transfer(reviews[rid].author, tokens);
        }

        emit RewardsDistributed(currentMonth);
    }

    // Funzioni ausiliarie per la heap (min-heap)

    function _heapifyUp(ReviewWeight[] memory heap, uint256 index) private pure {
        while (index > 0) {
            uint256 parent = (index - 1) / 2;
            if (heap[index].weight >= heap[parent].weight) break;
            ReviewWeight memory temp = heap[index];
            heap[index] = heap[parent];
            heap[parent] = temp;
            index = parent;
        }
    }

    function _heapifyDown(ReviewWeight[] memory heap, uint256 index, uint256 heapSize) private pure {
        while (true) {
            uint256 smallest = index;
            uint256 left = 2 * index + 1;
            uint256 right = 2 * index + 2;
            if (left < heapSize && heap[left].weight < heap[smallest].weight) {
                smallest = left;
            }
            if (right < heapSize && heap[right].weight < heap[smallest].weight) {
                smallest = right;
            }
            if (smallest == index) break;
            ReviewWeight memory temp = heap[index];
            heap[index] = heap[smallest];
            heap[smallest] = temp;
            index = smallest;
        }
    }

    /**
     * @dev Funzione di peso gaussiano semplificata wi(j).
     * Se j==mu restituisce peso massimo (1e18), altrimenti 1e18/( (j-mu)^2 + 1 ).
     */
    function gaussianWeight(uint256 j) public view returns (uint256) {
        int256 num = int256(j) - int256(mu);
        if (j == mu) {
            return 1e18;
        } else {
            return uint256(1e18 / (uint256(num * num) + 1));
        }
    }

    // Funzioni di amministrazione parametri

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
