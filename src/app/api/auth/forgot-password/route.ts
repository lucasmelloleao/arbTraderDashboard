import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { withAuth } from '@/lib/auth';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Por segurança, retorna mensagem genérica ou sucesso sem expor se o e-mail existe
      return NextResponse.json({
        message: 'Se o e-mail estiver cadastrado, você receberá o código de verificação.',
      });
    }

    // Gera um código numérico aleatório de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Válido por 15 minutos

    user.resetPasswordCode = code;
    user.resetPasswordExpires = expiresAt;
    await user.save();

    // Envia o e-mail via Resend
    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: user.email,
        subject: 'Seu código para alteração de senha - ArbTrade',
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 30px; border-radius: 12px;">
            <h2 style="color: #6366f1; margin-bottom: 10px;">ArbTrade - Alteração de Senha</h2>
            <p>Olá <strong>${user.name}</strong>,</p>
            <p>Você solicitou a alteração da sua senha. Utilize o código de 6 dígitos abaixo para confirmar:</p>
            <div style="background-color: #1e293b; padding: 15px 25px; border-radius: 8px; display: inline-block; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #38bdf8; margin: 20px 0;">
              ${code}
            </div>
            <p style="font-size: 13px; color: #94a3b8;">Este código é válido por <strong>15 minutos</strong>. Caso você não tenha solicitado esta alteração, ignore este e-mail.</p>
          </div>
        `,
      });
    } catch (emailErr: any) {
      console.error('❌ Falha ao enviar e-mail via Resend:', emailErr.message);
    }

    return NextResponse.json({
      message: 'Se o e-mail estiver cadastrado, você receberá o código de verificação.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao gerar código de verificação' }, { status: 500 });
  }
}
