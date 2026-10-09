import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("hunchqq", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = (anchor.workspace as any).Hunchqq ?? (anchor.workspace as any).HunchQQ as Program<any>;
  const admin = provider.wallet as anchor.Wallet;

  // Fixed future timestamp (2030-01-01) so tests are deterministic.
  const END_TIME = 1893456000;

  let configPda: PublicKey;
  let mint: anchor.web3.PublicKey;
  let treasuryToken: anchor.web3.PublicKey;
  let marketPda: PublicKey;
  let vaultPda: PublicKey;
  let marketId: anchor.BN;

  const creator = Keypair.generate();
  const alice = Keypair.generate(); // bets Yes, wins
  const bob = Keypair.generate(); // bets No, loses
  const carol = Keypair.generate(); // no bet, tries things
  const feeBps = 200; // 2%

  const configSeeds = [Buffer.from("config")];

  before(async () => {
    [configPda] = PublicKey.findProgramAddressSync(configSeeds, program.programId);

    // Test USDC-like mint (6 decimals).
    mint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 6);

    // Treasury token account owned by admin.
    treasuryToken = await createAccount(provider.connection, admin.payer, mint, admin.publicKey);

    // Fund users.
    for (const kp of [creator, alice, bob, carol]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
      const ata = await createAccount(provider.connection, admin.payer, mint, kp.publicKey);
      await mintTo(provider.connection, admin.payer, mint, ata, admin.payer, 1_000_000_000); // 1000 tokens
    }
  });

  it("initializes config", async () => {
    await program.methods
      .initializeConfig(feeBps, admin.publicKey)
      .accountsStrict({
        admin: admin.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config: any = await program.account.config.fetch(configPda);
    assert.equal(config.admin.toBase58(), admin.publicKey.toBase58());
    assert.equal(config.feeBps, feeBps);
    assert.equal(config.marketCount.toNumber(), 0);
    assert.equal(config.paused, false);
  });

  it("rejects double config init", async () => {
    try {
      await program.methods
        .initializeConfig(feeBps, admin.publicKey)
        .accountsStrict({
          admin: admin.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.toString(), "failed");
    }
  });

  it("rejects fee above max", async () => {
    const fresh = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(fresh.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
    try {
      await program.methods
        .initializeConfig(5000, admin.publicKey)
        .accountsStrict({
          admin: fresh.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([fresh])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("FeeTooHigh") || e.toString().includes("failed"),
        `unexpected error: ${e}`
      );
    }
  });

  async function createMarketFor(resolver: anchor.web3.PublicKey) {
    const config: any = await program.account.config.fetch(configPda);
    marketId = config.marketCount as anchor.BN;
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(marketId.toString()));

    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), idBuf],
      program.programId
    );
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    await program.methods
      .createMarket("Will BTC close above $100k on 2030-01-01?", new anchor.BN(END_TIME), resolver)
      .accountsStrict({
        creator: creator.publicKey,
        config: configPda,
        market: marketPda,
        mint,
        vault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();
  }

  it("creates a market", async () => {
    await createMarketFor(creator.publicKey);

    const market: any = await program.account.market.fetch(marketPda);
    assert.equal(market.id.toNumber(), 0);
    assert.equal(market.question, "Will BTC close above $100k on 2030-01-01?");
    assert.ok(market.yesPool.toNumber() === 0 && market.noPool.toNumber() === 0);
    assert.deepEqual(Object.keys(market.status), ["open"]);

    const vault = await getAccount(provider.connection, vaultPda);
    assert.equal(vault.amount.toString(), "0");
  });

  it("rejects question over 200 chars", async () => {
    const config: any = await program.account.config.fetch(configPda);
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(config.marketCount.toString()));
    const [m] = PublicKey.findProgramAddressSync([Buffer.from("market"), idBuf], program.programId);
    const [v] = PublicKey.findProgramAddressSync([Buffer.from("vault"), m.toBuffer()], program.programId);

    try {
      await program.methods
        .createMarket("x".repeat(201), new anchor.BN(END_TIME), creator.publicKey)
        .accountsStrict({
          creator: creator.publicKey,
          config: configPda,
          market: m,
          mint,
          vault: v,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("QuestionTooLong") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("rejects past end_time", async () => {
    const config: any = await program.account.config.fetch(configPda);
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(config.marketCount.toString()));
    const [m] = PublicKey.findProgramAddressSync([Buffer.from("market"), idBuf], program.programId);
    const [v] = PublicKey.findProgramAddressSync([Buffer.from("vault"), m.toBuffer()], program.programId);

    try {
      await program.methods
        .createMarket("past?", new anchor.BN(1000000), creator.publicKey)
        .accountsStrict({
          creator: creator.publicKey,
          config: configPda,
          market: m,
          mint,
          vault: v,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("InvalidEndTime") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  async function tokenAccountOf(owner: anchor.web3.PublicKey) {
    const parsed = await provider.connection.getParsedTokenAccountsByOwner(owner, { mint });
    return parsed.value[0].account.data.parsed.info.tokenAmount.amount as string;
  }

  async function placeBet(user: anchor.web3.Keypair, amount: number, outcome: number) {
    const ata = (await provider.connection.getParsedTokenAccountsByOwner(user.publicKey, { mint }))
      .value[0].pubkey;
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(marketId.toString()));
    const [pos] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .placeBet(new anchor.BN(amount), outcome)
      .accountsStrict({
        user: user.publicKey,
        config: configPda,
        market: marketPda,
        mint,
        userToken: ata,
        vault: vaultPda,
        position: pos,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    return pos;
  }

  it("accepts bets from both sides and updates pools", async () => {
    const aliceBefore = await tokenAccountOf(alice.publicKey);
    await placeBet(alice, 100_000_000, 1); // 100 USDC on Yes
    await placeBet(bob, 300_000_000, 0); // 300 USDC on No

    const market: any = await program.account.market.fetch(marketPda);
    assert.equal(market.yesPool.toNumber(), 100_000_000);
    assert.equal(market.noPool.toNumber(), 300_000_000);

    const aliceAfter = await tokenAccountOf(alice.publicKey);
    assert.equal(
      (BigInt(aliceBefore) - BigInt(aliceAfter)).toString(),
      "100000000"
    );

    const vault = await getAccount(provider.connection, vaultPda);
    assert.equal(vault.amount.toString(), "400000000");
  });

  it("accumulates repeat bets in the same position", async () => {
    await placeBet(alice, 50_000_000, 1);
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(marketId.toString()));
    const [pos] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), alice.publicKey.toBuffer()],
      program.programId
    );
    const position: any = await program.account.position.fetch(pos);
    assert.equal(position.yesAmount.toNumber(), 150_000_000);
    assert.equal(position.noAmount.toNumber(), 0);
    assert.equal(position.claimed, false);
  });

  it("rejects zero-amount bet", async () => {
    try {
      await placeBet(carol, 0, 1);
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("ZeroAmount") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("rejects invalid outcome side", async () => {
    try {
      await placeBet(carol, 1_000_000, 2);
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("InvalidOutcome") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("rejects resolve before end_time", async () => {
    try {
      await program.methods
        .resolveMarket(1)
        .accountsStrict({ resolver: creator.publicKey, market: marketPda })
        .signers([creator])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("EndTimeNotReached") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("rejects resolve from wrong signer", async () => {
    try {
      await program.methods
        .resolveMarket(1)
        .accountsStrict({ resolver: bob.publicKey, market: marketPda })
        .signers([bob])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("AccountNotInitialized") ||
          e.toString().includes("Unauthorized") ||
          e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("rejects bets after end_time", async () => {
    // Build a market that is already past end_time by writing a short-lived one
    // and time-traveling via a second market with end_time = now + 2s.
    const config: any = await program.account.config.fetch(configPda);
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(config.marketCount.toString()));
    const [m2] = PublicKey.findProgramAddressSync([Buffer.from("market"), idBuf], program.programId);
    const [v2] = PublicKey.findProgramAddressSync([Buffer.from("vault"), m2.toBuffer()], program.programId);

    const now = (await provider.connection.getBlockTime(await provider.connection.getSlot()));
    await program.methods
      .createMarket("short lived", new anchor.BN(now + 2), creator.publicKey)
      .accountsStrict({
        creator: creator.publicKey,
        config: configPda,
        market: m2,
        mint,
        vault: v2,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();

    // Wait for end_time to pass.
    await new Promise((r) => setTimeout(r, 3500));

    const ata = (await provider.connection.getParsedTokenAccountsByOwner(alice.publicKey, { mint }))
      .value[0].pubkey;
    const [pos2] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), m2.toBuffer(), alice.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .placeBet(new anchor.BN(1_000_000), 1)
        .accountsStrict({
          user: alice.publicKey,
          config: configPda,
          market: m2,
          mint,
          userToken: ata,
          vault: v2,
          position: pos2,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([alice])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("MarketClosed") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("full lifecycle: bet -> wait -> resolve -> winners claim -> fee withdraw", async () => {
    // Create market with end_time = now + 4s so we can time-travel by waiting.
    const config: any = await program.account.config.fetch(configPda);
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(config.marketCount.toString()));
    const [m3] = PublicKey.findProgramAddressSync([Buffer.from("market"), idBuf], program.programId);
    const [v3] = PublicKey.findProgramAddressSync([Buffer.from("vault"), m3.toBuffer()], program.programId);

    const now = await provider.connection.getBlockTime(await provider.connection.getSlot());
    await program.methods
      .createMarket("lifecycle market", new anchor.BN(now + 4), creator.publicKey)
      .accountsStrict({
        creator: creator.publicKey,
        config: configPda,
        market: m3,
        mint,
        vault: v3,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();

    // Bet while open: alice 100 on Yes, bob 300 on No.
    const bet = async (user: anchor.web3.Keypair, amount: number, outcome: number) => {
      const ata = (await provider.connection.getParsedTokenAccountsByOwner(user.publicKey, { mint }))
        .value[0].pubkey;
      const [pos] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), m3.toBuffer(), user.publicKey.toBuffer()],
        program.programId
      );
      await program.methods
        .placeBet(new anchor.BN(amount), outcome)
        .accountsStrict({
          user: user.publicKey,
          config: configPda,
          market: m3,
          mint,
          userToken: ata,
          vault: v3,
          position: pos,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      return pos;
    };

    const alicePos = await bet(alice, 100_000_000, 1);
    const bobPos = await bet(bob, 300_000_000, 0);

    // Wait until after end_time.
    await new Promise((r) => setTimeout(r, 5000));

    // Resolve: Yes wins.
    await program.methods
      .resolveMarket(1)
      .accountsStrict({ resolver: creator.publicKey, market: m3 })
      .signers([creator])
      .rpc();

    const resolved: any = await program.account.market.fetch(m3);
    assert.deepEqual(Object.keys(resolved.status), ["resolved"]);
    assert.equal(resolved.winningOutcome, 1);

    // Double resolve fails.
    try {
      await program.methods
        .resolveMarket(1)
        .accountsStrict({ resolver: creator.publicKey, market: m3 })
        .signers([creator])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("AlreadyFinalized") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }

    const bal = async (owner: anchor.web3.PublicKey) =>
      BigInt(await tokenAccountOf(owner));

    // Payout math: total=400, fee=2% = 8, payout_pool=392, winning=100
    // alice payout = 100 * 392 / 100 = 392 USDC.
    const aliceBefore = await bal(alice.publicKey);
    const aliceAta = (await provider.connection.getParsedTokenAccountsByOwner(alice.publicKey, { mint }))
      .value[0].pubkey;

    await program.methods
      .claimWinnings()
      .accountsStrict({
        user: alice.publicKey,
        config: configPda,
        market: m3,
        position: alicePos,
        mint,
        vault: v3,
        userToken: aliceAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([alice])
      .rpc();

    const aliceAfter = await bal(alice.publicKey);
    assert.equal((aliceAfter - aliceBefore).toString(), "392000000");

    // Double claim fails.
    try {
      await program.methods
        .claimWinnings()
        .accountsStrict({
          user: alice.publicKey,
          config: configPda,
          market: m3,
          position: alicePos,
          mint,
          vault: v3,
          userToken: aliceAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([alice])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("AlreadyClaimed") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }

    // Loser cannot claim.
    const bobAta = (await provider.connection.getParsedTokenAccountsByOwner(bob.publicKey, { mint }))
      .value[0].pubkey;
    try {
      await program.methods
        .claimWinnings()
        .accountsStrict({
          user: bob.publicKey,
          config: configPda,
          market: m3,
          position: bobPos,
          mint,
          vault: v3,
          userToken: bobAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([bob])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("NotWinner") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }

    // Admin withdraws the 8 USDC fee to treasury.
    await program.methods
      .withdrawFees()
      .accountsStrict({
        admin: admin.publicKey,
        config: configPda,
        market: m3,
        mint,
        vault: v3,
        treasuryToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const vault = await getAccount(provider.connection, v3);
    // Vault should hold exactly the loser's 300 (alice took 392, fee 8 out).
    assert.equal(vault.amount.toString(), "300000000");

    // Double fee withdraw fails.
    try {
      await program.methods
        .withdrawFees()
        .accountsStrict({
          admin: admin.publicKey,
          config: configPda,
          market: m3,
          mint,
          vault: v3,
          treasuryToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("AlreadyClaimed") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("auto-refunds when the winning side has zero bets", async () => {
    // Market where only No was bet, then resolve Yes (winning_pool == 0).
    const config: any = await program.account.config.fetch(configPda);
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(config.marketCount.toString()));
    const [m4] = PublicKey.findProgramAddressSync([Buffer.from("market"), idBuf], program.programId);
    const [v4] = PublicKey.findProgramAddressSync([Buffer.from("vault"), m4.toBuffer()], program.programId);

    const now = await provider.connection.getBlockTime(await provider.connection.getSlot());
    await program.methods
      .createMarket("one-sided", new anchor.BN(now + 3), creator.publicKey)
      .accountsStrict({
        creator: creator.publicKey,
        config: configPda,
        market: m4,
        mint,
        vault: v4,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();

    // Only bob bets No.
    const bobAta = (await provider.connection.getParsedTokenAccountsByOwner(bob.publicKey, { mint }))
      .value[0].pubkey;
    const [bobPos] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), m4.toBuffer(), bob.publicKey.toBuffer()],
      program.programId
    );
    await program.methods
      .placeBet(new anchor.BN(200_000_000), 0)
      .accountsStrict({
        user: bob.publicKey,
        config: configPda,
        market: m4,
        mint,
        userToken: bobAta,
        vault: v4,
        position: bobPos,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();

    await new Promise((r) => setTimeout(r, 4000));

    // Resolve Yes (nobody bet Yes) -> full refunds.
    await program.methods
      .resolveMarket(1)
      .accountsStrict({ resolver: creator.publicKey, market: m4 })
      .signers([creator])
      .rpc();

    // Winning pool == 0 -> claim_winnings refunds bob in full.
    const before = BigInt(await tokenAccountOf(bob.publicKey));
    await program.methods
      .claimWinnings()
      .accountsStrict({
        user: bob.publicKey,
        config: configPda,
        market: m4,
        position: bobPos,
        mint,
        vault: v4,
        userToken: bobAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([bob])
      .rpc();
    const after = BigInt(await tokenAccountOf(bob.publicKey));
    assert.equal((after - before).toString(), "200000000");

    // Vault drained to zero.
    const vault = await getAccount(provider.connection, v4);
    assert.equal(vault.amount.toString(), "0");

    // Fee withdraw rejected on zero-winner market.
    try {
      await program.methods
        .withdrawFees()
        .accountsStrict({
          admin: admin.publicKey,
          config: configPda,
          market: m4,
          mint,
          vault: v4,
          treasuryToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("NothingToClaim") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });


  it("rejects claim before resolution", async () => {
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(marketId.toString()));
    const [pos] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), alice.publicKey.toBuffer()],
      program.programId
    );
    const ata = (await provider.connection.getParsedTokenAccountsByOwner(alice.publicKey, { mint }))
      .value[0].pubkey;

    try {
      await program.methods
        .claimWinnings()
        .accountsStrict({
          user: alice.publicKey,
          config: configPda,
          market: marketPda,
          position: pos,
          mint,
          vault: vaultPda,
          userToken: ata,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([alice])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("MarketNotOpen") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("cancels a market and refunds bettors", async () => {
    // Cancel market 0 via its resolver (creator).
    await program.methods
      .cancelMarket()
      .accountsStrict({
        signer: creator.publicKey,
        config: configPda,
        market: marketPda,
      })
      .signers([creator])
      .rpc();

    const market: any = await program.account.market.fetch(marketPda);
    assert.deepEqual(Object.keys(market.status), ["cancelled"]);
  });

  it("rejects cancel from unauthorized signer", async () => {
    try {
      await program.methods
        .cancelMarket()
        .accountsStrict({ signer: bob.publicKey, config: configPda, market: marketPda })
        .signers([bob])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("Unauthorized") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("refunds full stake on cancelled market", async () => {
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(marketId.toString()));
    const [pos] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), alice.publicKey.toBuffer()],
      program.programId
    );
    const ata = (await provider.connection.getParsedTokenAccountsByOwner(alice.publicKey, { mint }))
      .value[0].pubkey;

    const before = BigInt(await tokenAccountOf(alice.publicKey));

    await program.methods
      .claimRefund()
      .accountsStrict({
        user: alice.publicKey,
        market: marketPda,
        position: pos,
        mint,
        vault: vaultPda,
        userToken: ata,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([alice])
      .rpc();

    const after = BigInt(await tokenAccountOf(alice.publicKey));
    assert.equal((after - before).toString(), "150000000"); // alice's total yes stake
  });

  it("rejects double refund", async () => {
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(marketId.toString()));
    const [pos] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), alice.publicKey.toBuffer()],
      program.programId
    );
    const ata = (await provider.connection.getParsedTokenAccountsByOwner(alice.publicKey, { mint }))
      .value[0].pubkey;

    try {
      await program.methods
        .claimRefund()
        .accountsStrict({
          user: alice.publicKey,
          market: marketPda,
          position: pos,
          mint,
          vault: vaultPda,
          userToken: ata,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([alice])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("AlreadyClaimed") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("refunds bob too (full stake both sides)", async () => {
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(marketId.toString()));
    const [pos] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), bob.publicKey.toBuffer()],
      program.programId
    );
    const ata = (await provider.connection.getParsedTokenAccountsByOwner(bob.publicKey, { mint }))
      .value[0].pubkey;

    const before = BigInt(await tokenAccountOf(bob.publicKey));
    await program.methods
      .claimRefund()
      .accountsStrict({
        user: bob.publicKey,
        market: marketPda,
        position: pos,
        mint,
        vault: vaultPda,
        userToken: ata,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([bob])
      .rpc();
    const after = BigInt(await tokenAccountOf(bob.publicKey));
    assert.equal((after - before).toString(), "300000000");

    // Vault fully drained after all refunds.
    const vault = await getAccount(provider.connection, vaultPda);
    assert.equal(vault.amount.toString(), "0");
  });

  it("rejects claim on cancelled market (use refund instead)", async () => {
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(marketId.toString()));
    const [pos] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), bob.publicKey.toBuffer()],
      program.programId
    );
    const ata = (await provider.connection.getParsedTokenAccountsByOwner(bob.publicKey, { mint }))
      .value[0].pubkey;

    try {
      await program.methods
        .claimWinnings()
        .accountsStrict({
          user: bob.publicKey,
          config: configPda,
          market: marketPda,
          position: pos,
          mint,
          vault: vaultPda,
          userToken: ata,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([bob])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("MarketCancelled") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });

  it("toggles pause and blocks new markets", async () => {
    await program.methods
      .setPaused(true)
      .accountsStrict({ admin: admin.publicKey, config: configPda })
      .rpc();

    let config: any = await program.account.config.fetch(configPda);
    assert.equal(config.paused, true);

    // Try to create a market while paused.
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(config.marketCount.toString()));
    const [m] = PublicKey.findProgramAddressSync([Buffer.from("market"), idBuf], program.programId);
    const [v] = PublicKey.findProgramAddressSync([Buffer.from("vault"), m.toBuffer()], program.programId);

    try {
      await program.methods
        .createMarket("paused test", new anchor.BN(END_TIME), creator.publicKey)
        .accountsStrict({
          creator: creator.publicKey,
          config: configPda,
          market: m,
          mint,
          vault: v,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("Paused") || e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }

    // Unpause.
    await program.methods
      .setPaused(false)
      .accountsStrict({ admin: admin.publicKey, config: configPda })
      .rpc();
    config = await program.account.config.fetch(configPda);
    assert.equal(config.paused, false);
  });

  it("rejects pause from non-admin", async () => {
    try {
      await program.methods
        .setPaused(true)
        .accountsStrict({ admin: bob.publicKey, config: configPda })
        .signers([bob])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.isTrue(
        e.toString().includes("Unauthorized") ||
          e.toString().includes("ConstraintRaw") ||
          e.toString().includes("failed"),
        `unexpected: ${e}`
      );
    }
  });
});
