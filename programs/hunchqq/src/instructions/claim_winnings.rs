use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::HunchQQError;
use crate::events::WinningsClaimed;
use crate::state::{Config, Market, MarketStatus, Position};

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [Config::SEEDS],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [Market::SEEDS_PREFIX, &market.id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [Position::SEEDS, market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.user == user.key() @ HunchQQError::Unauthorized,
        constraint = position.market == market.key() @ HunchQQError::MarketNotOpen,
    )]
    pub position: Account<'info, Position>,

    /// CHECK: mint validated by address = market.mint.
    #[account(address = market.mint)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [Market::VAULT_SEEDS_PREFIX, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = mint,
        token::authority = market,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token.owner == user.key() @ HunchQQError::Unauthorized,
        constraint = user_token.mint == market.mint @ HunchQQError::InvalidTreasury,
    )]
    pub user_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.position;

    require!(
        market.status == MarketStatus::Resolved,
        if market.status == MarketStatus::Cancelled {
            HunchQQError::MarketCancelled
        } else {
            HunchQQError::MarketNotOpen
        }
    );
    require!(!position.claimed, HunchQQError::AlreadyClaimed);

    let winning_outcome = market.winning_outcome.ok_or_else(|| error!(HunchQQError::MarketNotOpen))?;
    let total_pool = market.total_pool()?;
    let winning_pool = if winning_outcome == 1 {
        market.yes_pool
    } else {
        market.no_pool
    };

    let payout: u64;
    let stake: u64;

    if winning_pool == 0 {
        // Nobody bet the winning side: refund this position in full (spec §5.4).
        stake = position
            .yes_amount
            .checked_add(position.no_amount)
            .ok_or_else(|| error!(HunchQQError::Overflow))?;
        require!(stake > 0, HunchQQError::NothingToClaim);
        payout = stake;
    } else {
        stake = position.stake_on(winning_outcome);
        require!(stake > 0, HunchQQError::NotWinner);

        // fee = total_pool * fee_bps / 10_000 (u128, floored)
        let fee = (total_pool as u128)
            .checked_mul(config_fee_bps(&ctx.accounts.config) as u128)
            .ok_or_else(|| error!(HunchQQError::Overflow))?
            .checked_div(10_000u128)
            .ok_or_else(|| error!(HunchQQError::Overflow))?;

        // payout_pool = total_pool - fee (u128)
        let payout_pool = (total_pool as u128)
            .checked_sub(fee)
            .ok_or_else(|| error!(HunchQQError::Overflow))?;

        // payout = stake * payout_pool / winning_pool — floored so the vault never overpays.
        let payout_u128 = (stake as u128)
            .checked_mul(payout_pool)
            .ok_or_else(|| error!(HunchQQError::Overflow))?
            .checked_div(winning_pool as u128)
            .ok_or_else(|| error!(HunchQQError::Overflow))?;

        payout = u64::try_from(payout_u128).map_err(|_| error!(HunchQQError::Overflow))?;
        require!(payout > 0, HunchQQError::NothingToClaim);
    }

    // Pay out from the vault (market PDA is the sole authority).
    let id = market.id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        Market::SEEDS_PREFIX,
        id.as_ref(),
        &[market.bump],
    ];
    let signer = &[seeds];
    let cpi = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token.to_account_info(),
            authority: market.to_account_info(),
        },
        signer,
    );
    token::transfer(cpi, payout)?;

    // Once only.
    let position = &mut ctx.accounts.position;
    position.claimed = true;

    emit!(WinningsClaimed {
        market: market.key(),
        user: ctx.accounts.user.key(),
        outcome: winning_outcome,
        stake,
        payout,
    });

    msg!(
        "Claimed: market={}, user={}, stake={}, payout={}",
        market.id,
        ctx.accounts.user.key(),
        stake,
        payout
    );
    Ok(())
}

fn config_fee_bps(config: &Config) -> u16 {
    config.fee_bps
}
