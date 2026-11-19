"use client";

import { useState } from "react";
import { Character } from "./Character";
import { Label, PrimaryButton, TextInput } from "./ui";
import { supabase } from "@/lib/supabase";

type Tab = "login" | "signup" | "forgot";

const LOOK = { stage: 0, tier: 0, bills: 0, floor: 0, energy: "ok", aura: false, skin: 1, hair: 0 } as const;

/** Turns the server's English error text into something that says what to do. */
function explain(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password do not match. Check both, or use Forgot password.";
  if (m.includes("already registered") || m.includes("already been registered")) return "There is already an account with this email. Log in instead.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a few minutes and try again.";
  if (m.includes("password") && (m.includes("weak") || m.includes("least"))) return "Choose a longer password, at least 8 characters.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Open the message we sent you and tap the link.";
  if (m.includes("valid email") || m.includes("invalid email")) return "That does not look like an email address.";
  if (m.includes("fetch") || m.includes("network")) return "No connection. Check your internet and try again.";
  return message;
}

export function AuthScreen({ mode, onRecovered }: { mode: "login" | "recovery"; onRecovered: () => void }) {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const sb = supabase;
  if (!sb) return null;

  const switchTab = (t: Tab) => {
    setTab(t);
    setError("");
    setInfo("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    setError("");
    setInfo("");
    const mail = email.trim();

    if (mode === "recovery") {
      if (password.length < 8) return setError("Choose a password of at least 8 characters.");
      setBusy(true);
      const { error: err } = await sb.auth.updateUser({ password });
      setBusy(false);
      if (err) return setError(explain(err.message));
      onRecovered();
      return;
    }

    if (!mail) return setError("Enter your email address.");
    setBusy(true);
    try {
      if (tab === "login") {
        const { error: err } = await sb.auth.signInWithPassword({ email: mail, password });
        if (err) setError(explain(err.message));
      } else if (tab === "signup") {
        if (password.length < 8) return setError("Choose a password of at least 8 characters.");
        const { data, error: err } = await sb.auth.signUp({ email: mail, password });
        if (err) setError(explain(err.message));
        else if (data.user && data.user.identities?.length === 0) setError("There is already an account with this email. Log in instead.");
        else if (!data.session) setInfo(`We sent a confirmation link to ${mail}. Open it, then come back here and log in.`);
      } else {
        const { error: err } = await sb.auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin });
        if (err) setError(explain(err.message));
        else setInfo(`If there is an account for ${mail}, a link to choose a new password is on its way.`);
      }
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const recovery = mode === "recovery";
  const heading = recovery ? "New password" : tab === "login" ? "Log in" : tab === "signup" ? "Create account" : "Reset password";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-5 py-10">
      <div className="stage-dots mx-auto mb-6 rounded-[22px] bg-coal px-6 pt-3">
        <Character look={LOOK} width={150} still label="Your character, before you start" />
      </div>
      <h1 className="font-pixel text-[41px] leading-none">Life</h1>
      <p className="mb-6 mt-2 text-ash">Everything you log makes your character stronger and richer.</p>

      {!recovery && (
        <div role="tablist" aria-label="Account" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-coal p-1">
          {(["login", "signup"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t || (t === "login" && tab === "forgot")}
              onClick={() => switchTab(t)}
              className={`h-11 rounded-lg font-medium transition-colors ${tab === t || (t === "login" && tab === "forgot") ? "bg-pit text-bone" : "text-ash hover:text-bone"}`}
            >
              {t === "login" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <h2 className="sr-only">{heading}</h2>
        {!recovery && (
          <div>
            <Label htmlFor="email">Email</Label>
            <TextInput id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        {(recovery || tab !== "forgot") && (
          <div>
            <Label htmlFor="password">{recovery ? "Choose a new password" : "Password"}</Label>
            <TextInput
              id="password"
              type="password"
              autoComplete={recovery || tab === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {(tab === "signup" || recovery) && <p className="mt-1.5 text-[13px] text-ash">At least 8 characters.</p>}
          </div>
        )}

        <p role="alert" className="min-h-5 text-[14px] text-bad">{error}</p>
        {info && <p role="status" className="rounded-xl bg-coal p-3 text-[14px] text-bone">{info}</p>}

        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "One moment" : recovery ? "Save password" : tab === "login" ? "Log in" : tab === "signup" ? "Create account" : "Send reset link"}
        </PrimaryButton>

        {!recovery && tab === "login" && (
          <button type="button" onClick={() => switchTab("forgot")} className="h-11 w-full text-[14px] text-ash underline underline-offset-4 hover:text-bone">
            Forgot password
          </button>
        )}
        {!recovery && tab === "forgot" && (
          <button type="button" onClick={() => switchTab("login")} className="h-11 w-full text-[14px] text-ash underline underline-offset-4 hover:text-bone">
            Back to log in
          </button>
        )}
      </form>
    </main>
  );
}
