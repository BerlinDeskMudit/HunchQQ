use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::HunchQQError;
use crate::events::BetPlaced;
use crate::state::{Config, Market, Position};

#[derive(Accounts)]
pub struct PlaceBet<'info> {
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

    /// CHECK: mint is validated via the token accounts below.
    #[account(address = market.mint)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_token.owner == user.key(),
        constraint = user_token.mint == market.mint @ HunchQQError::InvalidOutcome,
    )]
    pub user_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [Market::VAULT_SEEDS_PREFIX, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = mint,
        token::authority = market,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Position::INIT_SPACE,
        seeds = [Position::SEEDS, market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PlaceBet>, amount: u64, outcome: u8) -> Result<()> {
    // Guards.
    require!(amount > 0, HunchQQError::ZeroAmount);
    require!(outcome <= 1, HunchQQError::InvalidOutcome);
    require!(!ctx.accounts.config.paused, HunchQQError::Paused);
    require!(
        ctx.accounts.market.is_open(),
        HunchQQError::MarketNotOpen
    );
    require!(
        Clock::get()?.unix_timestamp < ctx.accounts.market.end_time,
        HunchQQError::MarketClosed
    );

    // Transfer user -> vault.
    let cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_token.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::transfer(cpi, amount)?;

    // Pool accounting (checked).
    let market = &mut ctx.accounts.market;
    if outcome == 1 {
        market.yes_pool = market
            .yes_pool
            .checked_add(amount)
            .ok_or_else(|| error!(HunchQQError::Overflow))?;
    } else {
        market.no_pool = market
            .no_pool
            .checked_add(amount)
            .ok_or_else(|| error!(HunchQQError::Overflow))?;
    }

    // Position accounting (checked).
    let position = &mut ctx.accounts.position;
    if position.market == Pubkey::default() {
        // Fresh position from `init_if_needed`.
        position.market = market.key();
        position.user = ctx.accounts.user.key();
        position.claimed = false;
        position.bump = ctx.bumps.position;
    } else {
        require_keys_eq!(
            position.market,
            market.key(),
            HunchQQError::MarketNotOpen
        );
        require!(!position.claimed, HunchQQError::AlreadyClaimed);
    }
    if outcome == 1 {
        position.yes_amount = position
            .yes_amount
            .checked_add(amount)
            .ok_or_else(|| error!(HunchQQError::Overflow))?;
    } else {
        position.no_amount = position
            .no_amount
            .checked_add(amount)
            .ok_or_else(|| error!(HunchQQError::Overflow))?;
    }

    emit!(BetPlaced {
        market: market.key(),
        user: ctx.accounts.user.key(),
        outcome,
        amount,
        yes_pool: market.yes_pool,
        no_pool: market.no_pool,
    });

    msg!(
        "Bet placed: market={}, user={}, outcome={}, amount={}",
        market.id,
        ctx.accounts.user.key(),
        outcome,
        amount
    );
    Ok(())
}
