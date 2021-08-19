import * as assert from 'assert';
import * as anchor from '@project-serum/anchor';
import * as dotenv from 'dotenv';

dotenv.config();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("basic-1", () => {
  // Configure the client to use the devnet cluster.
  const rpcUrl = process.env.RPC_URL;
  const connection = new anchor.web3.Connection(rpcUrl);
  const key = process.env.KEY.split(',').map(str => parseInt(str));
  const keypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(key));
  const wallet = new anchor.Wallet(keypair);
  const option = anchor.Provider.defaultOptions();
  const provider = new anchor.Provider(connection, wallet, option);
  
  anchor.setProvider(provider);

  it("Creates and initializes an account in two different transactions", async () => {
    // The program owning the account to create.
    const program = anchor.workspace.Basic1;

    // The Account to create.
    const myAccount = anchor.web3.Keypair.generate();

    // Create account transaction.
    const tx = new anchor.web3.Transaction();
    tx.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: myAccount.publicKey,
        space: 8 + 8,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
          8 + 8
        ),
        programId: program.programId,
      })
    );

    // Execute the transaction against the cluster.
    await provider.send(tx, [myAccount]);
  
    await sleep(15000);
  
    // Execute the RPC.
    // #region code-separated
    await program.rpc.initialize(new anchor.BN(1234), {
      accounts: {
        myAccount: myAccount.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
    });
    // #endregion code-separated

    await sleep(15000);
    
    // Fetch the newly created account from the cluster.
    const account = await program.account.myAccount.fetch(myAccount.publicKey);

    // Check it's state was initialized.
    assert.ok(account.data.eq(new anchor.BN(1234)));
  });

  // Reference to an account to use between multiple tests.
  let _myAccount = undefined;

  it("Creates and initializes an account in a single atomic transaction", async () => {
    // The program to execute.
    const program = anchor.workspace.Basic1;

    // #region code
    // The Account to create.
    const myAccount = anchor.web3.Keypair.generate();

    // Atomically create the new account and initialize it with the program.
    await program.rpc.initialize(new anchor.BN(1234), {
      accounts: {
        myAccount: myAccount.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [myAccount],
      instructions: [
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: provider.wallet.publicKey,
          newAccountPubkey: myAccount.publicKey,
          space: 8 + 8, // Add 8 for the account discriminator.
          lamports: await provider.connection.getMinimumBalanceForRentExemption(
            8 + 8
          ),
          programId: program.programId,
        }),
      ],
    });

    await sleep(15000);

    // Fetch the newly created account from the cluster.
    const account = await program.account.myAccount.fetch(myAccount.publicKey);

    // Check it's state was initialized.
    assert.ok(account.data.eq(new anchor.BN(1234)));
    // #endregion code
  });

  it("Creates and initializes an account in a single atomic transaction (simplified)", async () => {
    // The program to execute.
    const program = anchor.workspace.Basic1;

    // The Account to create.
    const myAccount = anchor.web3.Keypair.generate();

    // Atomically create the new account and initialize it with the program.
    // #region code-simplified
    await program.rpc.initialize(new anchor.BN(1234), {
      accounts: {
        myAccount: myAccount.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [myAccount],
      instructions: [await program.account.myAccount.createInstruction(myAccount)],
    });
    // #endregion code-simplified

    await sleep(15000);

    // Fetch the newly created account from the cluster.
    const account = await program.account.myAccount.fetch(myAccount.publicKey);

    // Check it's state was initialized.
    assert.ok(account.data.eq(new anchor.BN(1234)));

    // Store the account for the next test.
    _myAccount = myAccount;
  });

  it("Updates a previously created account", async () => {
    const myAccount = _myAccount;

    // #region update-test

    // The program to execute.
    const program = anchor.workspace.Basic1;

    // Invoke the update rpc.
    await program.rpc.update(new anchor.BN(4321), {
      accounts: {
        myAccount: myAccount.publicKey,
      },
    });

    await sleep(15000);

    // Fetch the newly updated account.
    const account = await program.account.myAccount.fetch(myAccount.publicKey);

    // Check it's state was mutated.
    assert.ok(account.data.eq(new anchor.BN(4321)));

    // #endregion update-test
  });
});
