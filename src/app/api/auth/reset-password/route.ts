import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { withAuth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { code, newPassword } = await req.json();

    if (!code || typeof code !== 'string' || code.trim().length !== 6) {
      return NextResponse.json({ error: 'O código de verificação deve ter 6 dígitos' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres' }, { status: 400 });
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Valida o código (converte ambos para String para evitar incompatibilidade de tipo)
    const savedCode = String(user.resetPasswordCode || '').trim();
    const inputCode = String(code || '').trim();

    if (!user.resetPasswordCode || savedCode !== inputCode) {
      return NextResponse.json({ error: 'Código de verificação incorreto ou inválido' }, { status: 400 });
    }

    // Valida a expiração
    if (!user.resetPasswordExpires || new Date() > new Date(user.resetPasswordExpires)) {
      return NextResponse.json({ error: 'O código de verificação expirou. Solicite um novo código.' }, { status: 400 });
    }

    // Atualiza a senha criptografada
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return NextResponse.json({ message: 'Senha alterada com sucesso!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao redefinir a senha' }, { status: 500 });
  }
});
