// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SessionEscrow is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    enum EscrowStatus {
        CREATED,
        FUNDED,
        COMPLETED,
        DISPUTED,
        RELEASED,
        REFUNDED
    }

    struct Escrow {
        uint256 bookingId;
        address learner;
        address mentor;
        address tokenAddress;
        uint256 amount;
        uint256 feeBps;
        uint256 createdAt;
        uint256 deadline;
        EscrowStatus status;
    }

    mapping(uint256 => Escrow) public escrows;
    mapping(uint256 => bool) public bookingEscrowExists;
    uint256 public nextEscrowId = 1;
    address public treasury;

    event EscrowCreated(uint256 indexed escrowId, uint256 indexed bookingId, address learner, address mentor, uint256 amount, address tokenAddress);
    event EscrowFunded(uint256 indexed escrowId, address payer, uint256 amount);
    event EscrowReleased(uint256 indexed escrowId, address mentor, uint256 payout, uint256 platformFee);
    event EscrowRefunded(uint256 indexed escrowId, address learner, uint256 refundAmount);
    event DisputeRaised(uint256 indexed escrowId, address raisedBy);
    event DisputeResolved(uint256 indexed escrowId, bool releasedToMentor);

    constructor(address admin, address arbiter, address treasuryAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ARBITER_ROLE, arbiter);
        treasury = treasuryAddress;
    }

    function createEscrow(
        uint256 bookingId,
        address mentor,
        address tokenAddress,
        uint256 amount,
        uint256 feeBps,
        uint256 deadline
    ) external whenNotPaused returns (uint256 escrowId) {
        require(!bookingEscrowExists[bookingId], "Escrow already exists for booking");
        require(mentor != address(0), "Invalid mentor");
        require(amount > 0, "Amount must be > 0");
        require(feeBps <= 1000, "Fee too high");

        escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            bookingId: bookingId,
            learner: msg.sender,
            mentor: mentor,
            tokenAddress: tokenAddress,
            amount: amount,
            feeBps: feeBps,
            createdAt: block.timestamp,
            deadline: deadline,
            status: EscrowStatus.CREATED
        });

        bookingEscrowExists[bookingId] = true;
        emit EscrowCreated(escrowId, bookingId, msg.sender, mentor, amount, tokenAddress);
    }

    function fundEscrow(uint256 escrowId) external payable whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.learner == msg.sender, "Only learner can fund");
        require(e.status == EscrowStatus.CREATED, "Invalid status");

        if (e.tokenAddress == address(0)) {
            require(msg.value == e.amount, "Incorrect native amount");
        } else {
            require(msg.value == 0, "No native value allowed");
            IERC20(e.tokenAddress).transferFrom(msg.sender, address(this), e.amount);
        }

        e.status = EscrowStatus.FUNDED;
        emit EscrowFunded(escrowId, msg.sender, e.amount);
    }

    function markCompleted(uint256 escrowId) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        require(e.learner == msg.sender, "Only learner can complete");
        require(e.status == EscrowStatus.FUNDED, "Invalid status");
        e.status = EscrowStatus.COMPLETED;
    }

    function releaseFunds(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.COMPLETED, "Escrow not completed");

        uint256 fee = (e.amount * e.feeBps) / 10000;
        uint256 payout = e.amount - fee;
        e.status = EscrowStatus.RELEASED;

        _payout(e.tokenAddress, e.mentor, payout);
        if (fee > 0) {
            _payout(e.tokenAddress, treasury, fee);
        }

        emit EscrowReleased(escrowId, e.mentor, payout, fee);
    }

    function raiseDispute(uint256 escrowId) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        require(msg.sender == e.learner || msg.sender == e.mentor, "Not participant");
        require(e.status == EscrowStatus.FUNDED || e.status == EscrowStatus.COMPLETED, "Invalid status");
        e.status = EscrowStatus.DISPUTED;
        emit DisputeRaised(escrowId, msg.sender);
    }

    function resolveDisputeRelease(uint256 escrowId) external onlyRole(ARBITER_ROLE) nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.DISPUTED, "Not disputed");

        uint256 fee = (e.amount * e.feeBps) / 10000;
        uint256 payout = e.amount - fee;
        e.status = EscrowStatus.RELEASED;

        _payout(e.tokenAddress, e.mentor, payout);
        if (fee > 0) {
            _payout(e.tokenAddress, treasury, fee);
        }

        emit DisputeResolved(escrowId, true);
        emit EscrowReleased(escrowId, e.mentor, payout, fee);
    }

    function resolveDisputeRefund(uint256 escrowId) external onlyRole(ARBITER_ROLE) nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.DISPUTED, "Not disputed");

        e.status = EscrowStatus.REFUNDED;
        _payout(e.tokenAddress, e.learner, e.amount);

        emit DisputeResolved(escrowId, false);
        emit EscrowRefunded(escrowId, e.learner, e.amount);
    }

    function autoRefundAfterTimeout(uint256 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.FUNDED, "Invalid status");
        require(block.timestamp > e.deadline, "Deadline not reached");

        e.status = EscrowStatus.REFUNDED;
        _payout(e.tokenAddress, e.learner, e.amount);

        emit EscrowRefunded(escrowId, e.learner, e.amount);
    }

    function setTreasury(address treasuryAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(treasuryAddress != address(0), "Invalid treasury");
        treasury = treasuryAddress;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _payout(address tokenAddress, address to, uint256 amount) internal {
        if (tokenAddress == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "Native transfer failed");
        } else {
            IERC20(tokenAddress).transfer(to, amount);
        }
    }
}
