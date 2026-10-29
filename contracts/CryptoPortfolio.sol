// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title CryptoPortfolio
 * @dev On-chain decentralized cryptocurrency portfolio ledger on EVM
 */
contract CryptoPortfolio {

    struct Investment {
        uint256 id;
        string coin;
        uint256 quantity; // Scaled by 1,000,000 (1e6) to support 6 decimal places (e.g., 0.5 BTC = 500000)
        uint256 buyPrice; // Scaled by 100 to support 2 decimal places (e.g., ₹45,000.50 = 4500050)
        uint256 timestamp;
    }

    // Mapping from user wallet address to their investments
    mapping(address => Investment[]) private userInvestments;

    // Events emitted to the blockchain
    event InvestmentAdded(address indexed user, uint256 indexed id, string coin, uint256 quantity, uint256 buyPrice, uint256 timestamp);
    event InvestmentRemoved(address indexed user, uint256 indexed id);

    /**
     * @dev Add an investment to the blockchain ledger
     */
    function addInvestment(string memory _coin, uint256 _quantity, uint256 _buyPrice) public returns (uint256) {
        uint256 newId = block.timestamp + userInvestments[msg.sender].length;
        userInvestments[msg.sender].push(
            Investment(newId, _coin, _quantity, _buyPrice, block.timestamp)
        );
        emit InvestmentAdded(msg.sender, newId, _coin, _quantity, _buyPrice, block.timestamp);
        return newId;
    }

    /**
     * @dev Retrieve all investments for the caller's wallet
     */
    function getMyInvestments() public view returns (Investment[] memory) {
        return userInvestments[msg.sender];
    }

    /**
     * @dev Remove an investment from the blockchain ledger by ID
     */
    function removeInvestment(uint256 _id) public {
        Investment[] storage investments = userInvestments[msg.sender];
        for (uint256 i = 0; i < investments.length; i++) {
            if (investments[i].id == _id) {
                investments[i] = investments[investments.length - 1];
                investments.pop();
                emit InvestmentRemoved(msg.sender, _id);
                break;
            }
        }
    }
}
