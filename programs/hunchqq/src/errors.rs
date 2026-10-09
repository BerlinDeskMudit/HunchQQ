use anchor_lang::prelude::*;

/// Every failure path gets a code; the frontend maps these to friendly text
/// in `app/src/lib/errors.ts`.
#[error_code]
pub enum HunchQQError {
    #[msg("Question must not exceed 200 bytes")]
    QuestionTooLong,
    #[msg("Question must not be empty")]
    QuestionEmpty,
    #[msg("End time must be in the future")]
    InvalidEndTime,
    #[msg("Fee too high (max 1000 bps)")]
    FeeTooHigh,
    #[msg("Market is not open")]
    MarketNotOpen,
    #[msg("Betting period has ended")]
    MarketClosed,
    #[msg("Market is already resolved")]
    MarketResolved,
    #[msg("Market is cancelled")]
    MarketCancelled,
    #[msg("End time has not been reached yet")]
    EndTimeNotReached,
    #[msg("Outcome must be 0 (No) or 1 (Yes)")]
    InvalidOutcome,
    #[msg("Market is already resolved or cancelled")]
    AlreadyFinalized,
    #[msg("Position already claimed")]
    AlreadyClaimed,
    #[msg("Position has no claimable amount")]
    NothingToClaim,
    #[msg("This position did not win")]
    NotWinner,
    #[msg("Unauthorized signer")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Program is paused")]
    Paused,
    #[msg("Program is not paused")]
    NotPaused,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
}
