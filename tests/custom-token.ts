import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenMinter } from "../target/types/token_minter";
import {
  Connection,
  PublicKey,
  Signer,
  SystemProgram,
  TransactionSignature,
  TransactionConfirmationStatus,
  SignatureStatus,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { assert } from "chai";

describe("token_minter", () => {
  const getProvider = () => anchor.AnchorProvider.env();
  const provider = getProvider();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenMinter as Program<TokenMinter>;

  let mint: Signer;

  // Metaplex Constants
  const METADATA_SEED = "metadata";
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  // Constants from our program
  const MINT_SEED = "mint";

  // Test data
  const payer = provider.wallet.publicKey;
  const metadata = {
    name: "Just a Test Token",
    symbol: "TEST",
    uri: "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI",
    decimals: 9,
  };

  const [mintPublicKey, mintBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)],
    program.programId
  );

  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Helper function to confirm transactions
  async function confirmTransaction(
    connection: Connection,
    signature: TransactionSignature,
    desiredConfirmationStatus: TransactionConfirmationStatus = "confirmed",
    timeout: number = 30000,
    pollInterval: number = 1000,
    searchTransactionHistory: boolean = false
  ): Promise<SignatureStatus> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const { value: statuses } = await connection.getSignatureStatuses([signature], { searchTransactionHistory });

      if (!statuses || statuses.length === 0) {
        throw new Error("Failed to get signature status");
      }

      const status = statuses[0];

      if (status === null) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      if (status.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      }

      if (status.confirmationStatus && status.confirmationStatus === desiredConfirmationStatus) {
        return status;
      }

      if (status.confirmationStatus === "finalized") {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Transaction confirmation timeout after ${timeout}ms`);
  }

  it("initialize", async () => {
    const connection = provider.connection;

    // Initialize mint if it doesn't exist
    const info = await connection.getAccountInfo(mintPublicKey);
    if (info) {
      console.log("  Mint already initialized.");
      return;
    }

    console.log("  Mint not found. Initializing...");

    // Define transaction context
    const context = {
      metadata: metadataAddress,
      mint: mintPublicKey,
      payer: provider.wallet.publicKey, // Use provider wallet as payer
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID, // Correct program ID
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    };

    console.log("Context:", context);

    try {
      const txHash = await program.methods
        .initToken(metadata)
        .accounts(context)
        .rpc();

      console.log("Transaction sent. Awaiting confirmation...");
      
      await confirmTransaction(connection, txHash, "finalized");

      console.log(`Transaction confirmed: https://explorer.solana.com/tx/${txHash}?cluster=devnet`);

      const newInfo = await connection.getAccountInfo(mintPublicKey);
      assert(newInfo, "Mint should be initialized.");
    } catch (error) {
      console.error("Error during transaction:", error);
    }
  });
});
