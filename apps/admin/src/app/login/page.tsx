import { errorFor } from '@/lib/messages';
import { safeNext } from '@/lib/session';
import { LoginForm } from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="login">
      <h1>ApniRide Admin</h1>
      <p className="muted">Sign in with the admin username and password.</p>
      {errorFor(error) ? <p className="error">{errorFor(error)}</p> : null}
      <LoginForm next={safeNext(next)} />
    </main>
  );
}
