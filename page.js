"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getProgressFromExp, getCurrentRank, getNextRank } from "@/lib/levelSystem";

export default function Home() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadProfile();
      loadLogs();
    }
  }, [session]);

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    setProfile(data);
  }

  async function loadLogs() {
    const { data } = await supabase
      .from("study_logs")
      .select("*")
      .eq("user_id", session.user.id)
      .order("logged_date", { ascending: false })
      .limit(10);
    setLogs(data || []);
  }

  if (session === undefined) {
    return (
      <div className="page">
        <p className="brand">The Will of Focus</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <Dashboard
      session={session}
      profile={profile}
      logs={logs}
      onLogged={() => {
        loadProfile();
        loadLogs();
      }}
    />
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName || email.split("@")[0] } },
      });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  }

  return (
    <div className="page">
      <p className="brand">The Will of Focus</p>
      <h1 className="title">{mode === "login" ? "Welcome back" : "Start your climb"}</h1>

      <form className="card" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <>
            <label htmlFor="name">Display name</label>
            <input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What your party sees"
            />
          </>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
        />

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "One sec…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="muted-link">
        {mode === "login" ? (
          <>
            New here? <button onClick={() => setMode("signup")}>Create an account</button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button onClick={() => setMode("login")}>Log in</button>
          </>
        )}
      </p>
    </div>
  );
}

function Dashboard({ session, profile, logs, onLogged }) {
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalExp = profile?.total_exp ?? 0;
  const progress = getProgressFromExp(totalExp);
  const rank = getCurrentRank(progress.level);
  const nextRank = getNextRank(progress.level);

  async function logHours(e) {
    e.preventDefault();
    setError("");
    const numHours = parseFloat(hours);
    if (!numHours || numHours <= 0) {
      setError("Enter a valid number of hours.");
      return;
    }
    setSaving(true);

    // 1 hour = 1 base EXP (bonuses layer on top later)
    const { error: insertError } = await supabase.from("study_logs").insert({
      user_id: session.user.id,
      hours: numHours,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    const newTotalExp = totalExp + numHours;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ total_exp: newTotalExp })
      .eq("id", session.user.id);

    if (updateError) setError(updateError.message);

    setHours("");
    setSaving(false);
    onLogged();
  }

  return (
    <div className="page">
      <p className="brand">The Will of Focus</p>
      <h1 className="title">{profile?.display_name || "Loading…"}</h1>

      <div className="card">
        <div className="rank-line">
          <span className="rank-name">{rank.name}</span>
          <span className="level-badge">Level {progress.level}</span>
        </div>

        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${progress.percentToNextLevel}%` }} />
        </div>
        <div className="bar-caption">
          <span>
            {progress.isMaxLevel
              ? "Max level reached"
              : `${progress.expIntoCurrentLevel.toFixed(1)} / ${progress.expNeededForNextLevel} EXP`}
          </span>
          <span>{totalExp.toFixed(1)} total EXP</span>
        </div>

        {nextRank && (
          <p className="next-rank">
            Next rank: <strong>{nextRank.name}</strong> at level {nextRank.level}
          </p>
        )}
      </div>

      <form className="card" onSubmit={logHours}>
        <label htmlFor="hours">Log study hours</label>
        <div className="log-row">
          <input
            id="hours"
            type="number"
            step="0.25"
            min="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="e.g. 2.5"
          />
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Log"}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </form>

      {logs.length > 0 && (
        <div className="card">
          <label>Recent sessions</label>
          {logs.map((log) => (
            <div className="history-item" key={log.id}>
              <span>{log.hours} hrs</span>
              <span className="history-date">{log.logged_date}</span>
            </div>
          ))}
        </div>
      )}

      <button className="secondary" onClick={() => supabase.auth.signOut()}>
        Log out
      </button>
    </div>
  );
}
