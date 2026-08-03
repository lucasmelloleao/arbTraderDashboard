'use client';

import { useState, useEffect } from 'react';
import { User, Lock, Key, Shield, QrCode, ShieldOff } from 'lucide-react';
import clsx from 'clsx';
import { QRCodeSVG } from 'qrcode.react';

export default function ProfilePage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 2FA states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');

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
      }
    } catch (e) {
      console.error(e);
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
        setTwoFactorMessage('2FA enabled successfully!');
      } else {
        setTwoFactorError(data.error || 'Failed to verify 2FA');
      }
    } catch (err: any) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!confirm('Are you sure you want to disable 2FA? This will reduce the security of your account.')) return;
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
        setTwoFactorMessage('2FA disabled successfully.');
      } else {
        setTwoFactorError(data.error || 'Failed to disable 2FA');
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
        <h1 className="text-2xl font-bold text-white">User Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-medium text-white">Change Password</h2>
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

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Current Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  placeholder="Enter current password"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  placeholder="Enter new password"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
                  placeholder="Confirm new password"
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
                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-medium text-white">Two-Factor Authentication (2FA)</h2>
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
                  <h3 className="text-emerald-500 font-medium mb-1">2FA is Enabled</h3>
                  <p className="text-sm text-emerald-400/80">Your account is secured with two-factor authentication.</p>
                </div>
              </div>
              <button
                onClick={disable2FA}
                disabled={twoFactorLoading}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 mt-4"
              >
                <ShieldOff className="w-4 h-4" />
                {twoFactorLoading ? "Disabling..." : "Disable 2FA"}
              </button>
            </div>
          ) : (
            <div>
              {!qrCodeUrl ? (
                <div>
                  <p className="text-sm text-slate-400 mb-6">
                    Protect your account with an extra layer of security. Once configured, you'll be required to enter both your password and an authentication code from your mobile phone in order to sign in.
                  </p>
                  <button
                    onClick={generate2FA}
                    disabled={twoFactorLoading}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    {twoFactorLoading ? "Generating..." : "Set up 2FA"}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white p-4 rounded-xl inline-block mx-auto flex justify-center">
                    <QRCodeSVG value={qrCodeUrl} size={150} />
                  </div>
                  <p className="text-sm text-slate-400 text-center">
                    Scan this QR code with your authenticator app (like Google Authenticator or Authy).
                  </p>
                  <form onSubmit={verify2FA} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Verification Code</label>
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
                      {twoFactorLoading ? "Verifying..." : "Verify and Enable"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setQrCodeUrl('')}
                      className="w-full mt-2 text-slate-400 hover:text-white text-sm py-2"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
