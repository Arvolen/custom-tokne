// 1. Import dependencies
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3, 
        Metadata as Metaplex,
    },
};


declare_id!("9EQj1fWttG6tLmGnyZShJFWpBGmQd1FHFTzjTYHYsGSK");

// 3. Define the program and instructions
#[program]
mod token_minter {
    use super::*;

    // Main function to initialize token and create metadata
    pub fn init_token(ctx: Context<InitToken>, params: InitTokenParams) -> Result<()> {
        // Define the seeds for signing
        let seeds = &[b"mint".as_ref(), &[ctx.bumps.mint]];
        let signer = &[&seeds[..]];

        // Define token metadata
        let token_data = DataV2 {
            name: params.name,
            symbol: params.symbol,
            uri: params.uri,
            seller_fee_basis_points: 0, // Set fee basis points
            creators: None,  // Optionally add creators
            collection: None, // Optionally link to a collection
            uses: None,       // Optional uses for the token
        };

        // Create CPI Context for creating metadata accounts
        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.mint.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer,
        );

        // Create the token's metadata using Metaplex program
        create_metadata_accounts_v3(
            metadata_ctx,
            token_data,
            false,  // Is mutable?
            true,   // Update authority is signer?
            None,   // Optional collection details
        )?;

        msg!("Token mint and metadata created successfully.");

        Ok(())
    }
}

// 4. Define the context for each instruction
#[derive(Accounts)]
#[instruction(
    params: InitTokenParams
)]
pub struct InitToken<'info> {
    /// CHECK: New Metaplex Account being created
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    // Initialize the mint account with seeds
    #[account(
        init,
        seeds = [b"mint"], // Seed for PDA
        bump,
        payer = payer,
        mint::decimals = params.decimals, // Set decimals from params
        mint::authority = mint,           // Set mint authority
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,              // The payer of the transaction
    pub rent: Sysvar<'info, Rent>,         // Rent system account
    pub system_program: Program<'info, System>,   // System program for account creation
    pub token_program: Program<'info, Token>,     // Token program (SPL Token)
    pub token_metadata_program: Program<'info, Metaplex>, // Metaplex Token Metadata program
}

// 5. Define the InitTokenParams struct for token metadata and decimals
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,   // Token name
    pub symbol: String, // Token symbol
    pub uri: String,    // URI for token metadata
    pub decimals: u8,   // Token decimals
}
