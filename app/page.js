"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getProgressFromExp, getCurrentRank, getNextRank } from "@/lib/levelSystem";

async function setUserStatus(userId, status) {
  await supabase
    .from("profiles")
    .update({ current_status: status, status_updated_at: new Date().toISOString() })
    .eq("id", userId);
}

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

const ZONES = [
  { id: "dorm", label: "🛏 Dorm" },
  { id: "study", label: "📖 Study" },
  { id: "break", label: "☕ Break" },
  { id: "party", label: "👥 Party" },
];

function Dashboard({ session, profile, logs, onLogged }) {
  const [zone, setZone] = useState("study");

  const totalExp = profile?.total_exp ?? 0;
  const progress = getProgressFromExp(totalExp);
  const rank = getCurrentRank(progress.level);
  const nextRank = getNextRank(progress.level);

  return (
    <div className="page">
      <p className="brand">The Will of Focus</p>
      <h1 className="title">{profile?.display_name || "Loading…"}</h1>

      <div className="zone-nav">
        {ZONES.map((z) => (
          <button
            key={z.id}
            className={`zone-tab ${zone === z.id ? "active" : ""}`}
            onClick={() => setZone(z.id)}
          >
            {z.label}
          </button>
        ))}
      </div>

      {zone === "dorm" && (
        <DormZone progress={progress} rank={rank} nextRank={nextRank} totalExp={totalExp} />
      )}

      {zone === "study" && (
        <StudyZone
          session={session}
          totalExp={totalExp}
          logs={logs}
          onLogged={onLogged}
        />
      )}

      {zone === "break" && <BreakZone session={session} />}

      {zone === "party" && <PartyZone session={session} />}

      <button className="secondary" onClick={() => supabase.auth.signOut()}>
        Log out
      </button>
    </div>
  );
}

function DormZone({ progress, rank, nextRank, totalExp }) {
  return (
    <>
      <p className="zone-sub">Your room. Rank, level, and progress live here.</p>
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
      <div className="card">
        <label>Cosmetics</label>
        <p className="zone-sub" style={{ marginBottom: 0 }}>
          Coming soon — rank-locked skins and the store will show up here.
        </p>
      </div>
    </>
  );
}

function StudyZone({ session, totalExp, logs, onLogged }) {
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Timer state: counts seconds while running
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }

  async function saveHoursToBackend(numHours) {
    setError("");
    if (!numHours || numHours <= 0) {
      setError("Enter a valid number of hours.");
      return;
    }
    setSaving(true);

    const { error: insertError } = await supabase.from("study_logs").insert({
      user_id: session.user.id,
      hours: numHours,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ total_exp: totalExp + numHours })
      .eq("id", session.user.id);

    if (updateError) setError(updateError.message);

    setSaving(false);
    onLogged();
  }

  async function handleManualLog(e) {
    e.preventDefault();
    await saveHoursToBackend(parseFloat(hours));
    setHours("");
  }

  async function handleStopTimer() {
    setRunning(false);
    setUserStatus(session.user.id, "idle");
    const hoursStudied = seconds / 3600;
    if (hoursStudied > 0) {
      await saveHoursToBackend(hoursStudied);
    }
    setSeconds(0);
  }

  async function handleDelete(log) {
    const confirmed = window.confirm(`Delete this ${log.hours}hr session? This will also remove the EXP it gave you.`);
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("study_logs")
      .delete()
      .eq("id", log.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ total_exp: Math.max(totalExp - log.hours, 0) })
      .eq("id", session.user.id);

    if (updateError) setError(updateError.message);

    onLogged();
  }

  return (
    <>
      <p className="zone-sub">Start a timer, or log hours manually.</p>

      <div className="card">
        <div className="timer-display">{formatTime(seconds)}</div>
        <div className="timer-label">{running ? "Studying…" : "Timer stopped"}</div>
        <div className="timer-controls">
          {!running ? (
            <button
              onClick={() => {
                setRunning(true);
                setUserStatus(session.user.id, "studying");
              }}
            >
              {seconds > 0 ? "Resume" : "Start"}
            </button>
          ) : (
            <button
              className="secondary"
              onClick={() => {
                setRunning(false);
                setUserStatus(session.user.id, "idle");
              }}
            >
              Pause
            </button>
          )}
          <button
            className="secondary"
            onClick={handleStopTimer}
            disabled={seconds === 0 || saving}
          >
            {saving ? "Saving…" : "Stop & Log"}
          </button>
        </div>
      </div>

      <form className="card" onSubmit={handleManualLog}>
        <label htmlFor="hours">Or log hours manually</label>
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
              <button className="delete-btn" onClick={() => handleDelete(log)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BreakZone({ session }) {
  const [seconds, setSeconds] = useState(20 * 60); // 20 min default break
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const interval = setInterval(() => setSeconds((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(interval);
  }, [running, seconds]);

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function handleToggle() {
    const next = !running;
    setRunning(next);
    setUserStatus(session.user.id, next ? "on_break" : "idle");
  }

  function handleReset() {
    setRunning(false);
    setUserStatus(session.user.id, "idle");
    setSeconds(20 * 60);
  }

  return (
    <>
      <p className="zone-sub">Step away. This just counts down — your break bank balance comes in Phase 2.</p>
      <div className="card">
        <div className="timer-display">{formatTime(seconds)}</div>
        <div className="timer-label">{seconds === 0 ? "Break's over" : running ? "On break" : "Paused"}</div>
        <div className="timer-controls">
          <button onClick={handleToggle} disabled={seconds === 0}>
            {running ? "Pause" : "Start"}
          </button>
          <button className="secondary" onClick={handleReset}>
            Reset (20m)
          </button>
        </div>
      </div>
    </>
  );
}

const STATUS_LABELS = {
  studying: { label: "Studying", icon: "📖" },
  on_break: { label: "On break", icon: "☕" },
  idle: { label: "Idle", icon: "💤" },
};

function timeAgo(isoString) {
  if (!isoString) return "";
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function PartyZone({ session }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadMembers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, current_status, status_updated_at, total_exp")
      .order("display_name", { ascending: true });
    setMembers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadMembers();
    // Refresh every 8 seconds so party status feels roughly live
    const interval = setInterval(loadMembers, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <p className="zone-sub">
        {loading ? "Loading your party…" : "Everyone using The Will of Focus, live-ish."}
      </p>
      <div className="card">
        {members.map((m) => {
          const status = STATUS_LABELS[m.current_status] || STATUS_LABELS.idle;
          const isMe = m.id === session.user.id;
          return (
            <div className="history-item" key={m.id}>
              <span>
                {status.icon} {m.display_name}
                {isMe ? " (you)" : ""}
              </span>
              <span className="history-date">
                {status.label} · {timeAgo(m.status_updated_at)}
              </span>
            </div>
          );
        })}
        {members.length === 0 && !loading && <p className="zone-sub">Nobody's signed up yet.</p>}
      </div>
    </>
  );
}
