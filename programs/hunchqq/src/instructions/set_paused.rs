use anchor_lang::prelude::*;

use crate::errors::HunchQQError;
use crate::state::Config;

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [Config::SEEDS],
        bump = config.bump,
        constraint = config.admin == admin.key() @ HunchQQError::Unauthorized,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(config.paused != paused, HunchQQError::AlreadyFinalized);
    config.paused = paused;

    msg!("Pause set to {}", paused);
    Ok(())
}
