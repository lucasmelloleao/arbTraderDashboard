import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Wallet from '@/models/Wallet';
import { withAuth } from '@/lib/auth';
import { encryptSecretKey } from '@/lib/encryption';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const wallets = await Wallet.find({ userId });
    return NextResponse.json(wallets);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ethers } from 'ethers';

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { acronym, secretKey, network = 'Solana' } = await req.json();

    if (!acronym || !secretKey) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    let rawSecretKey = secretKey.trim();
    let derivedPublicKey = '';

    if (network === 'EVM') {
      // Process as EVM
      if (rawSecretKey.includes(' ')) {
        // Seed phrase
        try {
          const wallet = ethers.Wallet.fromPhrase(rawSecretKey);
          derivedPublicKey = wallet.address;
          rawSecretKey = wallet.privateKey; // normalize to hex private key
        } catch (err) {
          return NextResponse.json({ error: 'Invalid EVM seed phrase' }, { status: 400 });
        }
      } else {
        // Raw private key
        try {
          // ensure it starts with 0x for ethers
          const formattedKey = rawSecretKey.startsWith('0x') ? rawSecretKey : `0x${rawSecretKey}`;
          const wallet = new ethers.Wallet(formattedKey);
          derivedPublicKey = wallet.address;
          rawSecretKey = formattedKey;
        } catch (err) {
          return NextResponse.json({ error: 'Invalid EVM private key' }, { status: 400 });
        }
      }
    } else {
      // Process as Solana
      if (rawSecretKey.includes(' ')) {
        if (!bip39.validateMnemonic(rawSecretKey)) {
          return NextResponse.json({ error: 'Invalid seed phrase' }, { status: 400 });
        }
        const seed = bip39.mnemonicToSeedSync(rawSecretKey);
        const path = "m/44'/501'/0'/0'";
        const derivedSeed = derivePath(path, seed.toString('hex')).key;
        const keypair = Keypair.fromSeed(derivedSeed);
        derivedPublicKey = keypair.publicKey.toBase58();
        rawSecretKey = bs58.encode(keypair.secretKey);
      } else {
        // Treat as raw private key (base58)
        try {
          const keypair = Keypair.fromSecretKey(bs58.decode(rawSecretKey));
          derivedPublicKey = keypair.publicKey.toBase58();
        } catch (err) {
          return NextResponse.json({ error: 'Invalid private key format' }, { status: 400 });
        }
      }
    }

    const encryptedSecretKey = encryptSecretKey(rawSecretKey, derivedPublicKey);

    const wallet = await Wallet.create({ userId, acronym, network, publicKey: derivedPublicKey, secretKey: encryptedSecretKey });
    return NextResponse.json(wallet, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { id, acronym, publicKey, secretKey } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 });
    }

    const wallet = await Wallet.findOne({ _id: id, userId });
    if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    if (acronym) wallet.acronym = acronym;
    if (publicKey) wallet.publicKey = publicKey;
    if (secretKey) {
      // Re-encrypt the new secret key with the (possibly new) public key
      wallet.secretKey = encryptSecretKey(secretKey, wallet.publicKey);
    }

    await wallet.save();
    return NextResponse.json(wallet);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await Wallet.findOneAndDelete({ _id: id, userId });
    return NextResponse.json({ message: 'Wallet deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
