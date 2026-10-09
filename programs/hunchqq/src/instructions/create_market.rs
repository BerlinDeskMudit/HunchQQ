use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::HunchQQError;
use crate::events::MarketCreated;
use crate::state::{Config, Market, MarketStatus, MAX_QUESTION_LEN};

#[derive(Accounts)]
#[instruction(question: String, end_time: i64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [Config::SEEDS],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [Market::SEEDS_PREFIX, &config.market_count.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    /// SPL mint used for bets on this market.
    pub mint: Account<'info, Mint>,

    /// Vault token account owned by the market PDA.
    #[account(
        init,
        payer = creator,
        seeds = [Market::VAULT_SEEDS_PREFIX, market.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = market,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateMarket>,
    question: String,
    end_time: i64,
    resolver: Pubkey,
) -> Result<()> {
    // Input bounds.
    require!(!question.is_empty(), HunchQQError::QuestionEmpty);
    require!(
        question.len() <= MAX_QUESTION_LEN,
        HunchQQError::QuestionTooLong
    );
    require!(
        end_time > Clock::get()?.unix_timestamp,
        HunchQQError::InvalidEndTime
    );

    let config = &mut ctx.accounts.config;
    require!(!config.paused, HunchQQError::Paused);

    let market = &mut ctx.accounts.market;
    market.id = config.market_count;
    market.creator = ctx.accounts.creator.key();
    market.resolver = resolver;
    market.mint = ctx.accounts.mint.key();
    market.question = question;
    market.end_time = end_time;
    market.status = MarketStatus::Open;
    market.winning_outcome = None;
    market.yes_pool = 0;
    market.no_pool = 0;
    market.fee_collected = false;
    market.bump = ctx.bumps.market;
    market.vault_bump = ctx.bumps.vault;

    config.market_count = config
        .market_count
        .checked_add(1)
        .ok_or_else(|| error!(HunchQQError::Overflow))?;

    emit!(MarketCreated {
        market: market.key(),
        id: market.id,
        creator: market.creator,
        question: market.question.clone(),
        end_time: market.end_time,
        mint: market.mint,
    });

    msg!("Market {} created: {}", market.id, market.question);
    Ok(())
}
