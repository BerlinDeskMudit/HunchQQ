use anchor_lang::prelude::*;

use crate::errors::HunchQQError;
use crate::state::{Config, MAX_FEE_BPS};

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [Config::SEEDS],
        bump
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeConfig>, fee_bps: u16, treasury: Pubkey) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, HunchQQError::FeeTooHigh);
    require_keys_neq!(treasury, Pubkey::default(), HunchQQError::InvalidTreasury);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.treasury = treasury;
    config.fee_bps = fee_bps;
    config.market_count = 0;
    config.paused = false;
    config.bump = ctx.bumps.config;

    msg!(
        "Config initialized: admin={}, treasury={}, fee_bps={}",
        config.admin,
        config.treasury,
        config.fee_bps
    );
    Ok(())
}
