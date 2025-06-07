// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title MyTokenNFT (proof-of-purchase soulbound token)
/// @notice Un contratto minimalista per token “soulbound”: 
///         ogni token è identificato da un uint256 (qui lo useremo come orderId)
///         e non esistono funzioni di trasferimento. 

contract MyTokenNFT {

    // ----------------------------------------------------------------------------
    // 1) Struttura dati
    // ----------------------------------------------------------------------------
    
    struct TokenURI{
        uint256 orderId;
        address merchant;
    }
    
    struct TokenNFT {
        uint256 tokenId;
        address owner;
        TokenURI tokenURI;
    }

    uint256 private tokenHash = 1; // parte da 1, poi 2, 3, …

    // Ogni tokenId unico → informazioni sul token
    mapping(uint256 => TokenNFT) public tokensId;

    // Conta quanti token possiede ogni account
    mapping(address => uint256) public totalToken;

    // Per dire: l’indirizzo X possiede il token Y?
    mapping(address => mapping(uint256 => bool)) public tokenAccounts;

    // ----------------------------------------------------------------------------
    // 2) Eventi
    // ----------------------------------------------------------------------------
    // Manteniamo solo l’evento Transfer per indicare il mint, 
    // emulando il “Transfer(0x0 → owner, tokenId)” di ERC-721.
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenID);

    // ----------------------------------------------------------------------------
    // 3) Costruttore
    // ----------------------------------------------------------------------------
    constructor() {
        // (nessuna inizializzazione aggiuntiva)
    }


    // ----------------------------------------------------------------------------
    // 4) Funzione di mint “automatico”: assegna a recipient il prossimo tokenId = tokenHash
    // ----------------------------------------------------------------------------
    /// @notice Crea un nuovo TokenNFT “soulbound” (non trasferibile) con ID = tokenHash corrente,
    ///         lo assegna a recipient e incrementa tokenHash di 1.
    /// @param recipient  L’indirizzo che riceverà il token.
    function mint(address recipient, uint256 orderId, address merchant) external {

        require(recipient != address(0), "MyTokenNFT: mint a zero address");
        uint256 newTokenId = tokenHash;
        require(tokensId[newTokenId].owner == address(0), "MyTokenNFT: token gia esistente");

        // Popolo la struct per tokenId e segno che esiste
        tokensId[newTokenId] = TokenNFT({
            tokenId: newTokenId,
            owner: recipient,
            tokenURI: TokenURI({
                orderId : orderId,
                merchant : merchant
            })
        });

        // Dico che recipient possiede il token newTokenId
        tokenAccounts[recipient][newTokenId] = true;

        // Incremento il balance di recipient
        totalToken[recipient] += 1;

        // Emulo l’evento Transfer(0x0 → recipient, newTokenId)
        emit Transfer(address(0), recipient, newTokenId);

        // Aggiorno il contatore per il prossimo mint
        tokenHash++;
    }

    // ----------------------------------------------------------------------------
    // 5) Funzioni di sola lettura “soulbound”: ownerOf, exists, balanceOf
    // ----------------------------------------------------------------------------

    /// @notice Ritorna l’indirizzo proprietario del token `tokenId`.
    /// @param tokenId  L’identificativo del token (sequenziale, assegnato internamente).
    /// @return address Indirizzo che possiede quel token.
    function ownerOf(uint256 tokenId) public view returns (address) {
        require(tokensId[tokenId].owner != address(0), "MyTokenNFT: token inesistente");
        return tokensId[tokenId].owner;
    }


    /// @notice Restituisce `true` se esiste un token con ID `tokenId`, `false` altrimenti.
    /// @param tokenId  L’identificativo del token.
    /// @return bool    Se il token è già stato creato.
    function exists(uint256 tokenId) public view returns (bool) {
        return tokensId[tokenId].owner != address(0);
    }

    /// @notice Ritorna quanti token ha in totale l’indirizzo `owner`.
    /// @param owner    L’indirizzo di cui chiedere il bilancio.
    /// @return uint256 Numero di token soulbound in possesso di `owner`.
    function balanceOf(address owner) public view returns (uint256) {
        return totalToken[owner];
    }

    // ----------------------------------------------------------------------------
    // 6) Nessuna funzione transfer/approve: è un semplice soulbound token
    // ----------------------------------------------------------------------------
}