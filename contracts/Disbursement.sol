pragma solidity ^0.7.6;
import "./HATToken.sol";


/// @title Disbursement contract - allows to distribute tokens over time
/// @author Stefan George - <stefan@gnosis.pm>
contract Disbursement {

    /*
     *  Storage
     */
    address public receiver;
    address public wallet;
    uint public disbursementPeriod;
    uint public startDate;
    uint public withdrawnTokens;
    HATToken public token;

    /*
     *  Modifiers
     */
    modifier isReceiver() {
        require(msg.sender == receiver, "Only receiver is allowed to proceed");
        _;
    }

    modifier isWallet() {
        require(msg.sender == wallet, "Only wallet is allowed to proceed");
        _;
    }

    /*
     *  Public functions
     */
    /// @dev Constructor function sets the wallet address, which is allowed to withdraw all tokens anytime
    /// @param _receiver Receiver of vested tokens
    /// @param _wallet Gnosis multisig wallet address
    /// @param _disbursementPeriod Vesting period in seconds
    /// @param _startDate Start date of disbursement period (cliff)
    /// @param _token ERC20 token used for the vesting
    constructor(address _receiver, address _wallet, uint _disbursementPeriod, uint _startDate, HATToken _token)
        public
    {
        require(_receiver != address(0) &&
                _wallet != address(0) &&
                _disbursementPeriod != 0 &&
                address(_token) != address(0), "Arguments are null");
        receiver = _receiver;
        wallet = _wallet;
        disbursementPeriod = _disbursementPeriod;
        startDate = _startDate;
        token = _token;
        if (startDate == 0) {
            startDate = block.timestamp;
        }
        token.delegate(_receiver);
    }

    /// @dev Transfers tokens to a given address
    /// @param _to Address of token receiver
    /// @param _value Number of tokens to transfer
    function withdraw(address _to, uint256 _value)
        public
        isReceiver
    {
        uint maxTokens = calcMaxWithdraw();
        require(_value <= maxTokens, "Withdraw amount exceeds allowed tokens");
        withdrawnTokens += _value;
        token.transfer(_to, _value);
    }

    /// @dev Transfers all tokens to multisig wallet
    function walletWithdraw()
        public
        isWallet
    {
        uint balance = token.balanceOf(address(this));
        withdrawnTokens += balance;
        token.transfer(wallet, balance);
    }

    /// @dev Calculates the maximum amount of vested tokens
    /// @return Number of vested tokens to withdraw
    function calcMaxWithdraw()
        public
        view
        returns (uint)
    {
        uint maxTokens = (token.balanceOf(address(this)) + withdrawnTokens) * (block.timestamp - startDate) / disbursementPeriod;
        if (withdrawnTokens >= maxTokens || startDate > block.timestamp){
            return 0;
        }
        return maxTokens - withdrawnTokens;
    }

    /// @dev delegate voting power
    /// @param _delegatee Address of delegatee
    function delegate(address _delegatee)
        public
        isReceiver
    {
        token.delegate(_delegatee);
    }
}
