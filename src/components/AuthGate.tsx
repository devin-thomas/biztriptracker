import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Check, Loader2, Mail, RefreshCw } from 'lucide-react';
import { isNeonConfigured, neonClient } from '../services/neonClient.js';

interface AuthGateProps { children: React.ReactNode; }
type AuthSession = { user: { email?: string | null; name?: string | null } };

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(isNeonConfigured);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = async () => {
    if (!neonClient) return;
    setIsLoading(true);
    try {
      const authError = new URLSearchParams(window.location.search).get('error');
      if (authError) {
        setError(`Sign-in link could not be completed: ${authError.replaceAll('_', ' ').toLowerCase()}.`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      const result = await neonClient.auth.getSession();
      if (result.error) throw new Error(result.error.message);
      setSession(result.data as AuthSession | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your account session.');
    } finally { setIsLoading(false); }
  };

  useEffect(() => { void loadSession(); }, []);

  const sendMagicLink = async (value: string) => {
    if (!neonClient) return;
    const normalizedEmail = value.trim().toLowerCase();
    if (!normalizedEmail) { setError('Enter your email address to continue.'); return; }
    setError(null); setIsSending(true);
    try {
      const result = await neonClient.auth.signIn.magicLink({
        email: normalizedEmail,
        callbackURL: window.location.origin,
        errorCallbackURL: window.location.origin,
      });
      if (result.error) throw new Error(result.error.message);
      setSentTo(normalizedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send a sign-in link.');
    } finally { setIsSending(false); }
  };

  const requestMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMagicLink(email);
  };

  const signOut = async () => {
    if (!neonClient) return;
    const result = await neonClient.auth.signOut();
    if (result.error) { setError(result.error.message || 'Unable to sign out.'); return; }
    setSession(null); setSentTo(null);
  };

  if (!isNeonConfigured) return <AuthShell><AuthMessage title="Account setup is incomplete" body="This deployment needs its Neon Auth and Data API URLs before the tracker can open." /></AuthShell>;
  if (isLoading) return <AuthShell><AuthMessage title="Loading your account" body="Checking your saved workspace." loading /></AuthShell>;
  if (session) return <><div className="signed-in-app">{children}</div><button type="button" className="account-button" onClick={() => void signOut()} title="Sign out">{session.user.email || 'Account'} · Sign out</button></>;

  return <AuthShell>{sentTo ? <section className="auth-card" aria-labelledby="auth-sent-title">
    <div className="auth-icon success-auth-icon"><Check size={21} /></div><span className="section-kicker">CHECK YOUR INBOX</span>
    <h1 id="auth-sent-title">Your sign-in link is on its way.</h1><p>We sent a passwordless link to <strong>{sentTo}</strong>. Open it on this device to view your saved trips and expenses.</p>
    <div className="auth-actions"><button type="button" className="primary-action auth-submit" onClick={() => void sendMagicLink(sentTo)} disabled={isSending}>{isSending ? <><Loader2 size={17} className="spin" /> Resending...</> : <><RefreshCw size={16} /> Resend link</>}</button><button type="button" className="secondary-action auth-secondary-action" onClick={() => setSentTo(null)}>Use a different email</button></div>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </section> : <section className="auth-card" aria-labelledby="auth-title">
    <div className="auth-icon"><Mail size={21} /></div><span className="section-kicker">PRIVATE WORKSPACE</span><h1 id="auth-title">Sign in to your trips.</h1>
    <p>Use your email to receive a secure sign-in link. No password to remember.</p>
    <form onSubmit={requestMagicLink} className="auth-form"><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /><button type="submit" className="primary-action auth-submit" disabled={isSending}>{isSending ? <><Loader2 size={17} className="spin" /> Sending link...</> : <>Email me a sign-in link <ArrowRight size={17} /></>}</button></form>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </section>}</AuthShell>;
};

function AuthShell({ children }: { children: React.ReactNode }) { return <div className="auth-shell"><header className="brand-header"><div className="brand-lockup"><span className="brand-icon"><BriefcaseBusiness size={18} /></span><span>Trip Expense Tracker</span></div><span className="save-state">ACCOUNT ACCESS</span></header><main className="auth-main">{children}</main></div>; }
function AuthMessage({ title, body, loading = false }: { title: string; body: string; loading?: boolean }) { return <section className="auth-card auth-message"><div className="auth-icon">{loading ? <Loader2 size={21} className="spin" /> : <BriefcaseBusiness size={21} />}</div><h1>{title}</h1><p>{body}</p></section>; }
