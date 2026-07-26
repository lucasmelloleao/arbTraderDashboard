import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/solana_flash_db';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// @ts-ignore
let cached = global.mongoose;

if (!cached) {
  // @ts-ignore
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    };

    console.log('🔌 [MongoDB] Tentando conectar ao Atlas...');
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ [MongoDB] Conectado com sucesso!');
      return mongoose;
    }).catch((err) => {
      console.error('❌ [MongoDB] Falha na conexão:', err.message, err.code);
      cached.promise = null; // reseta para tentar novamente na próxima request
      throw err;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectToDatabase;
