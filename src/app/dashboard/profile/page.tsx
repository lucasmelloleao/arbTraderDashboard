'use client';

import { useState, useEffect } from 'react';
import { User, Lock, Key, Shield, QrCode, ShieldOff, Send, MessageSquare, Bot, HelpCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '@/lib/i18n';

export default function ProfilePage() {
  const { t } = useLanguage();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Reset via email code states
  const [resetStep, setResetStep] = useState<'normal' | 'code_sent'>('normal');
  const [resetCode, setResetCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  const handleSendResetCode = async () => {
    setCodeLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'Código de 6 dígitos enviado para o seu e-mail!');
        setResetStep('code_sent');
      } else {
        setError(data.error || 'Falha ao enviar código por e-mail');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao solicitar código');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleResetWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    if (resetCode.length !== 6) {
      setError('Informe o código de 6 dígitos enviado por e-mail');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ code: resetCode, newPassword })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('Senha alterada com sucesso via código de e-mail!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setResetCode('');
        setResetStep('normal');
      } else {
        setError(data.error || 'Falha ao redefinir a senha');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  // 2FA states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');

  // Telegram States
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState('');
  const [telegramError, setTelegramError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTwoFactorEnabled(data.twoFactorEnabled || false);
        setTelegramBotToken(data.telegramBotToken || '');
        setTelegramChatId(data.telegramChatId || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setTelegramLoading(true);
    setTelegramError('');
    setTelegramMessage('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ telegramBotToken, telegramChatId })
      });
      const data = await res.json();
      if (res.ok) {
        setTelegramMessage('Configurações do Telegram salvas com sucesso!');
        setTelegramBotToken(data.telegramBotToken || '');
        setTelegramChatId(data.telegramChatId || '');
      } else {
        setTelegramError(data.error || 'Falha ao salvar configurações do Telegram');
      }
    } catch (err: any) {
      setTelegramError(err.message || 'Erro inesperado ao salvar');
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('Password changed successfully');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generate2FA = async () => {
    setTwoFactorLoading(true);
    setTwoFactorError('');
    setTwoFactorMessage('');
    try {
      const res = await fetch('/api/auth/2fa/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        setQrCodeUrl(data.otpauthUrl);
      } else {
        setTwoFactorError(data.error || 'Failed to generate 2FA');
      }
    } catch (err: any) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const verify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorError('');
    setTwoFactorMessage('');
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ twoFactorToken })
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFactorEnabled(true);
        setQrCodeUrl('');
        setTwoFactorToken('');
        setTwoFactorMessage('2FA ativado com sucesso!');
      } else {
        setTwoFactorError(data.error || 'Falha ao verificar 2FA');
      }
    } catch (err: any) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!confirm('Tem certeza que deseja desativar o 2FA? Isso reduzirá a segurança da sua conta.')) return;
    setTwoFactorLoading(true);
    setTwoFactorError('');
    setTwoFactorMessage('');
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFactorEnabled(false);
        setTwoFactorMessage('2FA desativado com sucesso.');
      } else {
        setTwoFactorError(data.error || 'Falha ao desativar 2FA');
      }
    } catch (err: any) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <User className="w-8 h-8 text-indigo-500" />
        <h1 className="text-2xl font-bold text-white">{t('usuario')}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-medium text-white">{t('alterarSenha')}</h2>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={resetStep === 'code_sent' ? handleResetWithCode : handleChangePassword} className="space-y-4">
            {resetStep === 'normal' ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-400">{t('senhaAtual')}</label>
                  <button
                    type="button"
                    onClick={handleSendResetCode}
                    disabled={codeLoading}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                  >
                    {codeLoading ? "Enviando e-mail..." : "Não lembra a senha? Enviar código por e-mail"}
                  </button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                    placeholder="Digite a senha atual"
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-400">Código de Verificação (6 dígitos enviado por e-mail)</label>
                  <button
                    type="button"
                    onClick={() => setResetStep('normal')}
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    Voltar ao modo padrão
                  </button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow font-mono tracking-widest text-center"
                    placeholder="000000"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('novaSenha')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  placeholder="Digite a nova senha"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('confirmarSenha')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  placeholder="Confirme a nova senha"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={loading}
                className={clsx(
                  "w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex items-center justify-center gap-2",
                  loading && "opacity-70 cursor-not-allowed"
                )}
              >
                {loading ? "Atualizando..." : resetStep === 'code_sent' ? "Redefinir Senha com Código" : "Alterar Senha"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-medium text-white">{t('autenticacaoDoisFatores')}</h2>
          </div>

          {twoFactorError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {twoFactorError}
            </div>
          )}
          {twoFactorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              {twoFactorMessage}
            </div>
          )}

          {twoFactorEnabled ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3">
                <Shield className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-emerald-500 font-medium mb-1">{t('habilitado')}</h3>
                  <p className="text-sm text-emerald-400/80">{t('contaProtegida')}</p>
                </div>
              </div>
              <button
                onClick={disable2FA}
                disabled={twoFactorLoading}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 mt-4"
              >
                <ShieldOff className="w-4 h-4" />
                {twoFactorLoading ? "Desativando..." : t('desativar2FA')}
              </button>
            </div>
          ) : (
            <div>
              {!qrCodeUrl ? (
                <div>
                  <p className="text-sm text-slate-400 mb-6">
                    Proteja sua conta com uma camada extra de segurança. Após configurado, você precisará inserir sua senha e um código de autenticação do seu celular para entrar.
                  </p>
                  <button
                    onClick={generate2FA}
                    disabled={twoFactorLoading}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    {twoFactorLoading ? "Gerando..." : t('configurar2FA')}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white p-4 rounded-xl inline-block mx-auto flex justify-center">
                    <QRCodeSVG value={qrCodeUrl} size={150} />
                  </div>
                  <p className="text-sm text-slate-400 text-center">
                    Escaneie este QR Code com seu aplicativo autenticador (como Google Authenticator ou Authy).
                  </p>
                  <form onSubmit={verify2FA} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Código de Verificação</label>
                      <div className="relative">
                        <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          value={twoFactorToken}
                          onChange={(e) => setTwoFactorToken(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow font-mono tracking-widest text-center"
                          placeholder="000000"
                          maxLength={6}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={twoFactorLoading}
                      className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex items-center justify-center gap-2"
                    >
                      {twoFactorLoading ? "Verificando..." : "Verificar e Ativar"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setQrCodeUrl('')}
                      className="w-full mt-2 text-slate-400 hover:text-white text-sm py-2"
                    >
                      {t('cancelar')}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Telegram Integration Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Send className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-medium text-white">Integração com o Telegram</h2>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Configure seu <strong>Bot Token</strong> (do <code className="text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded">@BotFather</code>) e seu <strong>Chat ID</strong> (do <code className="text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded">@userinfobot</code>) para receber notificações e comandos exclusivos das suas operações.
          </p>

          {telegramError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {telegramError}
            </div>
          )}
          {telegramMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              {telegramMessage}
            </div>
          )}

          <form onSubmit={handleSaveTelegram} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Telegram Bot Token</label>
                <div className="relative">
                  <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow font-mono"
                    placeholder="8523015362:AAE80zQhff..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Telegram Chat ID</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow font-mono"
                    placeholder="999232604"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={telegramLoading}
                className={clsx(
                  "bg-indigo-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex items-center justify-center gap-2",
                  telegramLoading && "opacity-70 cursor-not-allowed"
                )}
              >
                {telegramLoading ? "Salvando..." : "Salvar Configurações do Telegram"}
              </button>
            </div>
          </form>

          {/* Passo a Passo / Tutorial Telegram */}
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-medium text-sm">
              <HelpCircle className="w-4 h-4" />
              <span>Passo a Passo: Como obter o Bot Token e o Chat ID no Telegram</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Passo 1 */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">1</span>
                  <span>Criar o seu Bot</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  No Telegram, busque por <strong>@BotFather</strong>, inicie a conversa e envie o comando <code className="text-indigo-300">/newbot</code>.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Escolha o nome do seu robô e copie o <strong>HTTP API Token</strong> gerado (ex: <code className="text-slate-300">852301...</code>).
                </p>
              </div>

              {/* Passo 2 */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">2</span>
                  <span>Descobrir o seu Chat ID</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Busque pelo bot <strong>@userinfobot</strong> ou <strong>@raw_data_bot</strong> e envie o comando <code className="text-indigo-300">/start</code>.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Copie o número retornado no campo <strong>Id</strong> (ex: <code className="text-slate-300">999232604</code>).
                </p>
              </div>

              {/* Passo 3 */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">3</span>
                  <span>Ativar o Bot</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Abra a conversa direta com o <strong>seu bot recém-criado</strong> no Telegram e clique em <strong>/start</strong>.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Preencha os campos acima, clique em <strong>Salvar</strong> e pronto! Você passará a receber notificações em tempo real.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
