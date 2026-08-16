const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../flash-solana/.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  await mongoose.connect(uri);

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

  const email = 'lucasmelloleao@gmail.com';
  const user = await User.findOne({ email });

  if (!user) {
    console.error(`Usuário ${email} não encontrado no banco de dados.`);
    await mongoose.disconnect();
    return;
  }

  const token = '8523015362:AAE80zQhff-PSvl61rI2hgA9ox19ZzpEcIc';
  const chatId = '999232604';

  user.telegramBotToken = token;
  user.telegramChatId = chatId;
  await user.save();

  console.log(`✅ Sucesso! Credenciais do Telegram atribuídas ao usuário ${email}:`);
  console.log(`- ID: ${user._id}`);
  console.log(`- Email: ${user.email}`);
  console.log(`- telegramBotToken: ${user.telegramBotToken}`);
  console.log(`- telegramChatId: ${user.telegramChatId}`);

  await mongoose.disconnect();
}

run().catch(console.error);
