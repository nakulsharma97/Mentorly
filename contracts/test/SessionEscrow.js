const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const FEE_BPS = 500n; // 5%
const ZERO = ethers.ZeroAddress;

async function deployEscrowFixture() {
  const [admin, arbiter, learner, mentor, stranger, treasury] = await ethers.getSigners();
  const Escrow = await ethers.getContractFactory("SessionEscrow");
  const escrow = await Escrow.deploy(admin.address, arbiter.address, treasury.address);
  await escrow.waitForDeployment();
  return { escrow, admin, arbiter, learner, mentor, stranger, treasury };
}

async function latestTimestamp() {
  return BigInt((await ethers.provider.getBlock("latest")).timestamp);
}

/** Creates and funds escrow #1. Returns { escrowId, deadline }. */
async function createAndFund(
  escrow,
  learner,
  mentor,
  { amount, token, deadlineDelta = 3600, feeBps = FEE_BPS } = {}
) {
  const tokenAddress = token ? await token.getAddress() : ZERO;
  const deadline = (await latestTimestamp()) + BigInt(deadlineDelta);
  await (
    await escrow.connect(learner).createEscrow(1n, mentor.address, tokenAddress, amount, feeBps, deadline)
  ).wait();

  if (token) {
    await (await token.connect(learner).approve(await escrow.getAddress(), amount)).wait();
    await (await escrow.connect(learner).fundEscrow(1n)).wait();
  } else {
    await (await escrow.connect(learner).fundEscrow(1n, { value: amount })).wait();
  }
  return { escrowId: 1n, deadline };
}

/** Advances the chain clock by `seconds` blocks. */
async function increaseTime(seconds) {
  await network.provider.send("evm_increaseTime", [Number(seconds)]);
  await network.provider.send("evm_mine");
}

describe("SessionEscrow", function () {
  describe("releaseFunds access control", function () {
    it("reverts when called by an unauthorized account", async function () {
      const { escrow, learner, mentor, stranger } = await deployEscrowFixture();
      await createAndFund(escrow, learner, mentor, { amount: 1000n });
      await (await escrow.connect(learner).markCompleted(1n)).wait();

      await expect(escrow.connect(stranger).releaseFunds(1n)).to.be.revertedWith(
        "Not authorized to release"
      );
    });

    it("allows the learner to release after completion", async function () {
      const { escrow, learner, mentor, treasury } = await deployEscrowFixture();
      const amount = 1000n;
      await createAndFund(escrow, learner, mentor, { amount });
      await (await escrow.connect(learner).markCompleted(1n)).wait();

      const mentorBefore = await ethers.provider.getBalance(mentor.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await (await escrow.connect(learner).releaseFunds(1n)).wait();

      const fee = (amount * FEE_BPS) / 10000n;
      expect((await escrow.connect(learner).escrows(1n)).status).to.equal(4n); // RELEASED
      expect(await ethers.provider.getBalance(mentor.address)).to.equal(mentorBefore + (amount - fee));
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(treasuryBefore + fee);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
    });

    it("allows the mentor to release after completion", async function () {
      const { escrow, learner, mentor, treasury } = await deployEscrowFixture();
      const amount = 1000n;
      await createAndFund(escrow, learner, mentor, { amount });
      await (await escrow.connect(learner).markCompleted(1n)).wait();

      const fee = (amount * FEE_BPS) / 10000n;
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      const mentorBefore = await ethers.provider.getBalance(mentor.address);
      const receipt = await (await escrow.connect(mentor).releaseFunds(1n)).wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      // The mentor pays the gas for their own release call.
      expect(await ethers.provider.getBalance(mentor.address)).to.equal(
        mentorBefore + (amount - fee) - gasCost
      );
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(treasuryBefore + fee);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
    });

    it("allows an arbiter to release after completion", async function () {
      const { escrow, learner, mentor, arbiter } = await deployEscrowFixture();
      const amount = 1000n;
      await createAndFund(escrow, learner, mentor, { amount });
      await (await escrow.connect(learner).markCompleted(1n)).wait();

      const mentorBefore = await ethers.provider.getBalance(mentor.address);
      await (await escrow.connect(arbiter).releaseFunds(1n)).wait();

      const fee = (amount * FEE_BPS) / 10000n;
      expect(await ethers.provider.getBalance(mentor.address)).to.equal(mentorBefore + (amount - fee));
    });

    it("still reverts for unauthorized callers even when escrow is completed", async function () {
      const { escrow, learner, mentor, admin } = await deployEscrowFixture();
      await createAndFund(escrow, learner, mentor, { amount: 1000n });
      await (await escrow.connect(learner).markCompleted(1n)).wait();

      // DEFAULT_ADMIN_ROLE is NOT an implicit release authority.
      await expect(escrow.connect(admin).releaseFunds(1n)).to.be.revertedWith(
        "Not authorized to release"
      );
    });
  });

  describe("createEscrow deadline validation", function () {
    it("rejects a deadline in the past", async function () {
      const { escrow, learner, mentor } = await deployEscrowFixture();
      const past = (await latestTimestamp()) - 1n;

      await expect(
        escrow.connect(learner).createEscrow(1n, mentor.address, ZERO, 100n, FEE_BPS, past)
      ).to.be.revertedWith("Deadline must be in the future");
    });

    it("rejects a deadline equal to the current block timestamp", async function () {
      const { escrow, learner, mentor } = await deployEscrowFixture();
      const now = await latestTimestamp();

      await expect(
        escrow.connect(learner).createEscrow(1n, mentor.address, ZERO, 100n, FEE_BPS, now)
      ).to.be.revertedWith("Deadline must be in the future");
    });

    it("accepts a future deadline", async function () {
      const { escrow, learner, mentor } = await deployEscrowFixture();
      const future = (await latestTimestamp()) + 3600n;

      await expect(
        escrow.connect(learner).createEscrow(1n, mentor.address, ZERO, 100n, FEE_BPS, future)
      ).to.emit(escrow, "EscrowCreated");
    });
  });

  describe("fee rounding dust", function () {
    it("leaves no native dust in the contract for odd amounts", async function () {
      const { escrow, learner, mentor } = await deployEscrowFixture();
      const amount = 333n;
      const feeBps = 777n;
      await createAndFund(escrow, learner, mentor, { amount, feeBps });
      await (await escrow.connect(learner).markCompleted(1n)).wait();

      const mentorBefore = await ethers.provider.getBalance(mentor.address);
      const treasuryBefore = await ethers.provider.getBalance(await escrow.treasury());
      await (await escrow.connect(learner).releaseFunds(1n)).wait();

      // fee is floored, so fee + payout == amount exactly.
      const fee = (amount * feeBps) / 10000n;
      const payout = amount - fee;
      expect(await ethers.provider.getBalance(mentor.address)).to.equal(mentorBefore + payout);
      expect(await ethers.provider.getBalance(await escrow.treasury())).to.equal(treasuryBefore + fee);
      // No remainder stranded in the escrow contract.
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
    });

    it("handles a tiny amount where the fee floors to zero", async function () {
      const { escrow, learner, mentor } = await deployEscrowFixture();
      const amount = 1n;
      const feeBps = 500n; // 5% of 1 wei -> floors to 0
      await createAndFund(escrow, learner, mentor, { amount, feeBps });
      await (await escrow.connect(learner).markCompleted(1n)).wait();

      const mentorBefore = await ethers.provider.getBalance(mentor.address);
      await (await escrow.connect(learner).releaseFunds(1n)).wait();

      expect(await ethers.provider.getBalance(mentor.address)).to.equal(mentorBefore + 1n);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
    });

    it("releases ERC20 escrows completely and reverts on failed funding", async function () {
      const { escrow, learner, mentor, treasury } = await deployEscrowFixture();
      const Mock = await ethers.getContractFactory("MockERC20");
      const token = await Mock.deploy();
      await token.waitForDeployment();

      const amount = 12345n;
      const feeBps = 777n;
      const fee = (amount * feeBps) / 10000n;
      const payout = amount - fee;

      await (await token.mint(learner.address, amount)).wait();
      await createAndFund(escrow, learner, mentor, { amount, token, feeBps });
      await (await escrow.connect(learner).markCompleted(1n)).wait();

      const escrowAddr = await escrow.getAddress();
      const mentorBefore = await token.balanceOf(mentor.address);
      const treasuryBefore = await token.balanceOf(await escrow.treasury());

      // Learner with no allowance cannot fund -> SafeERC20 reverts.
      const otherAmount = 100n;
      const deadline = (await latestTimestamp()) + 3600n;
      await (
        await escrow.connect(learner).createEscrow(2n, mentor.address, await token.getAddress(), otherAmount, feeBps, deadline)
      ).wait();
      await expect(escrow.connect(learner).fundEscrow(2n)).to.be.reverted;

      await (await escrow.connect(mentor).releaseFunds(1n)).wait();

      expect(await token.balanceOf(mentor.address)).to.equal(mentorBefore + payout);
      expect(await token.balanceOf(await escrow.treasury())).to.equal(treasuryBefore + fee);
      expect(await token.balanceOf(escrowAddr)).to.equal(0n);
    });
  });

  describe("arbiter dispute resolution (regression)", function () {
    it("raises a dispute and arbiter releases to the mentor", async function () {
      const { escrow, learner, mentor, arbiter, treasury } = await deployEscrowFixture();
      const amount = 1000n;
      await createAndFund(escrow, learner, mentor, { amount });
      await (await escrow.connect(learner).markCompleted(1n)).wait();
      await (await escrow.connect(learner).raiseDispute(1n)).wait();

      const fee = (amount * FEE_BPS) / 10000n;
      const mentorBefore = await ethers.provider.getBalance(mentor.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await expect(escrow.connect(arbiter).resolveDisputeRelease(1n))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(1n, true);

      expect(await ethers.provider.getBalance(mentor.address)).to.equal(mentorBefore + (amount - fee));
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(treasuryBefore + fee);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
      expect((await escrow.connect(learner).escrows(1n)).status).to.equal(4n); // RELEASED
    });

    it("raises a dispute and arbiter refunds the learner", async function () {
      const { escrow, learner, mentor, arbiter } = await deployEscrowFixture();
      const amount = 1000n;
      await createAndFund(escrow, learner, mentor, { amount });
      await (await escrow.connect(learner).markCompleted(1n)).wait();
      await (await escrow.connect(mentor).raiseDispute(1n)).wait();

      const learnerBefore = await ethers.provider.getBalance(learner.address);

      await expect(escrow.connect(arbiter).resolveDisputeRefund(1n))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(1n, false);

      expect(await ethers.provider.getBalance(learner.address)).to.be.greaterThan(learnerBefore);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
      expect((await escrow.connect(learner).escrows(1n)).status).to.equal(5n); // REFUNDED
    });

    it("reverts when a non-arbiter calls resolveDisputeRelease", async function () {
      const { escrow, learner, mentor, stranger } = await deployEscrowFixture();
      await createAndFund(escrow, learner, mentor, { amount: 1000n });
      await (await escrow.connect(learner).markCompleted(1n)).wait();
      await (await escrow.connect(learner).raiseDispute(1n)).wait();

      await expect(escrow.connect(stranger).resolveDisputeRelease(1n)).to.be.reverted;
    });
  });

  describe("autoRefundAfterTimeout", function () {
    it("reverts before the deadline", async function () {
      const { escrow, learner, mentor } = await deployEscrowFixture();
      await createAndFund(escrow, learner, mentor, { amount: 1000n, deadlineDelta: 3600 });

      await expect(escrow.connect(learner).autoRefundAfterTimeout(1n)).to.be.revertedWith(
        "Deadline not reached"
      );
    });

    it("refunds the learner at the deadline", async function () {
      const { escrow, learner, mentor } = await deployEscrowFixture();
      const amount = 1000n;
      await createAndFund(escrow, learner, mentor, { amount, deadlineDelta: 3600 });

      await increaseTime(3600);

      const learnerBefore = await ethers.provider.getBalance(learner.address);
      await (await escrow.connect(mentor).autoRefundAfterTimeout(1n)).wait();

      expect(await ethers.provider.getBalance(learner.address)).to.be.greaterThan(learnerBefore);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
      const e = await escrow.connect(learner).escrows(1n);
      expect(e.status).to.equal(5n); // REFUNDED
    });

    it("reverts for escrows that are not FUNDED", async function () {
      const { escrow, learner, mentor } = await deployEscrowFixture();
      const deadline = (await latestTimestamp()) + 3600n;
      await (await escrow.connect(learner).createEscrow(1n, mentor.address, ZERO, 100n, FEE_BPS, deadline)).wait();

      await increaseTime(3600);
      await expect(escrow.connect(learner).autoRefundAfterTimeout(1n)).to.be.revertedWith("Invalid status");
    });

    it("reverts while the contract is paused", async function () {
      const { escrow, admin, learner, mentor } = await deployEscrowFixture();
      await createAndFund(escrow, learner, mentor, { amount: 1000n, deadlineDelta: 3600 });
      await (await escrow.connect(admin).pause()).wait();

      await increaseTime(3600);
      // OZ v5 Pausable reverts with the EnforcedPause custom error.
      await expect(escrow.connect(mentor).autoRefundAfterTimeout(1n)).to.be.revertedWithCustomError(
        escrow,
        "EnforcedPause"
      );
    });
  });
});
