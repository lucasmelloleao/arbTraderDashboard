import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Wallet from '@/models/Wallet';
import { withAuth } from '@/lib/auth';
import { encryptSecretKey } from '@/lib/encryption';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ethers } from 'ethers';

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { acronym, network = 'Solana' } = await req.json();

    if (!acronym) {
      return NextResponse.json({ error: 'Acronym is required' }, { status: 400 });
    }

    let mnemonic = '';
    let derivedPublicKey = '';
    let secretKeyRaw = '';

    if (network === 'EVM') {
      const wallet = ethers.Wallet.createRandom();
      mnemonic = wallet.mnemonic?.phrase || '';
      derivedPublicKey = wallet.address;
      secretKeyRaw = wallet.privateKey;
    } else {
      mnemonic = bip39.generateMnemonic();
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const path = "m/44'/501'/0'/0'";
      const derivedSeed = derivePath(path, seed.toString('hex')).key;
      const keypair = Keypair.fromSeed(derivedSeed);
      derivedPublicKey = keypair.publicKey.toBase58();
      secretKeyRaw = bs58.encode(keypair.secretKey);
    }

    const encryptedSecretKey = encryptSecretKey(secretKeyRaw, derivedPublicKey);

    const wallet = await Wallet.create({
      userId,
      acronym,
      network,
      publicKey: derivedPublicKey,
      secretKey: encryptedSecretKey
    });

    return NextResponse.json({
      wallet,
      mnemonic
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
