"use client";

import { getRankStyle, getAvatarDisplay, RANK_TIERS, AVATAR_OPTIONS } from "@/lib/rankStyle";
import { getCurrentWeekRange, getBossState } from "@/lib/partySystem";
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
      <MusicZone />
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
const CURATED_PLAYLISTS = [
  { id: "37i9dQZF1DWWQRwui0ExPn", label: "Lofi Beats" },
  { id: "37i9dQZF1DX8Uebhn9wzrS", label: "Chill Lofi Study Beats" },
  { id: "37i9dQZF1DWZeKCadgRdKQ", label: "Deep Focus" },
  { id: "37i9dQZF1DX4sWSpwq3LiO", label: "Peaceful Piano" },
];

function extractSpotifyPlaylistId(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;
  return null;
}

function MusicZone() {
  const [selectedId, setSelectedId] = useState(CURATED_PLAYLISTS[0].id);
  const [customUrl, setCustomUrl] = useState("");
  const [customError, setCustomError] = useState("");

  function handleCustomSubmit(e) {
    e.preventDefault();
    setCustomError("");
    const id = extractSpotifyPlaylistId(customUrl);
    if (!id) {
      setCustomError("Paste a Spotify playlist link (or just the playlist ID).");
      return;
    }
    setSelectedId(id);
    setCustomUrl("");
  }

  return (
    <div className="card">
      <label>Study music</label>
      <div className="zone-nav" style={{ marginBottom: 12 }}>
        {CURATED_PLAYLISTS.map((p) => (
          <button
            key={p.id}
            className={`zone-tab ${selectedId === p.id ? "active" : ""}`}
            onClick={() => setSelectedId(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <iframe
        style={{ borderRadius: 12 }}
        src={`https://open.spotify.com/embed/playlist/${selectedId}?utm_source=generator`}
        width="100%"
        height="352"
        frameBorder="0"
        allowFullScreen=""
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      ></iframe>

      <form onSubmit={handleCustomSubmit} style={{ marginTop: 12 }}>
        <label htmlFor="custom-playlist">Or paste your own Spotify playlist link</label>
        <div className="log-row">
          <input
            id="custom-playlist"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/..."
          />
          <button type="submit">Load</button>
        </div>
        {customError && <p className="error-text">{customError}</p>}
      </form>
    </div>
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
function ProfileZone({ session, profile, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalExp = profile?.total_exp ?? 0;
  const progress = getProgressFromExp(totalExp);
  const rank = getCurrentRank(progress.level);
  const style = getRankStyle(rank.rank);
  const avatarId = getAvatarDisplay(profile?.avatar_id);

  async function chooseAvatar(id) {
    setError("");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ avatar_id: id }).eq("id", session.user.id);
    if (error) setError(error.message);
    setSaving(false);
    onUpdated();
  }

  return (
    <>
      <p className="zone-sub">Your public card — this is what friends see.</p>

      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>{avatarId}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: style.color }}>
          <span style={{ marginRight: 6 }}>{style.symbol}</span>
          {profile?.display_name}
        </div>
        <p className="zone-sub" style={{ marginTop: 4, marginBottom: 0 }}>
          {style.tierName} tier · {rank.name} · Level {progress.level}
        </p>
      </div>

      <div className="card">
        <label>Choose your pfp</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {AVATAR_OPTIONS.map((id) => (
            <button
              key={id}
              onClick={() => chooseAvatar(id)}
              disabled={saving}
              style={{
                fontSize: 28,
                padding: "8px 10px",
                borderRadius: 10,
                border: avatarId === id ? "2px solid #f2c879" : "1px solid rgba(255,255,255,0.15)",
                background: avatarId === id ? "rgba(242,200,121,0.12)" : "transparent",
                cursor: "pointer",
              }}
            >
              {id}
            </button>
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <label>Rank insignia ladder</label>
        <p className="zone-sub" style={{ marginBottom: 8 }}>
          Your name color and symbol upgrade automatically as you climb tiers.
        </p>
        {RANK_TIERS.map((t) => (
          <div className="history-item" key={t.tierName}>
            <span style={{ color: t.color, fontWeight: 600 }}>
              {t.symbol} {t.tierName}
            </span>
            <span className="history-date">up to rank #{t.maxRank}</span>
          </div>
        ))}
      </div>
    </>
  );
              }
            
function PartyZone({ session }) {
  const [friends, setFriends] = useState([]); // accepted, with profile info + status
  const [incoming, setIncoming] = useState([]); // pending requests sent to me
  const [outgoing, setOutgoing] = useState([]); // pending requests I sent
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  // ── Squad / weekly boss state ──
  const [myMembership, setMyMembership] = useState(null); // my row in party_members, or null
  const [squadMembers, setSquadMembers] = useState([]); // accepted members of my squad
  const [squadPending, setSquadPending] = useState([]); // invited-not-yet-accepted members of my squad
  const [weekHoursByUser, setWeekHoursByUser] = useState({});
  const [squadName, setSquadName] = useState("");
  const [squadError, setSquadError] = useState("");
  const [squadBusy, setSquadBusy] = useState(false);

  async function loadFriendData() {
    const myId = session.user.id;

    const { data: friendships } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);

    const rows = friendships || [];
    const accepted = rows.filter((f) => f.status === "accepted");
    const incomingPending = rows.filter((f) => f.status === "pending" && f.addressee_id === myId);
    const outgoingPending = rows.filter((f) => f.status === "pending" && f.requester_id === myId);

    const otherIds = [
      ...accepted.map((f) => (f.requester_id === myId ? f.addressee_id : f.requester_id)),
      ...incomingPending.map((f) => f.requester_id),
      ...outgoingPending.map((f) => f.addressee_id),
    ];

    let profileMap = {};
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, current_status, status_updated_at, total_exp")
        .in("id", otherIds);
      (profiles || []).forEach((p) => (profileMap[p.id] = p));
    }

    setFriends(
      accepted.map((f) => {
        const otherId = f.requester_id === myId ? f.addressee_id : f.requester_id;
        return { friendshipId: f.id, ...profileMap[otherId] };
      })
    );
    setIncoming(incomingPending.map((f) => ({ friendshipId: f.id, ...profileMap[f.requester_id] })));
    setOutgoing(outgoingPending.map((f) => ({ friendshipId: f.id, ...profileMap[f.addressee_id] })));
    setLoading(false);
  }

  async function loadSquadData() {
    const myId = session.user.id;

    // Do I belong to a party at all (invited or accepted)?
    const { data: mine } = await supabase
      .from("party_members")
      .select("id, party_id, status, parties(id, name, created_by)")
      .eq("user_id", myId)
      .limit(1)
      .maybeSingle();

    if (!mine) {
      setMyMembership(null);
      setSquadMembers([]);
      setSquadPending([]);
      setWeekHoursByUser({});
      return;
    }
    setMyMembership(mine);

    const { data: allRows } = await supabase
      .from("party_members")
      .select("id, user_id, status, profiles(id, display_name)")
      .eq("party_id", mine.party_id);

    const rows = allRows || [];
    const accepted = rows.filter((r) => r.status === "accepted");
    const invited = rows.filter((r) => r.status === "invited");
    setSquadMembers(accepted);
    setSquadPending(invited);

    if (accepted.length > 0) {
      const { start, end } = getCurrentWeekRange();
      const acceptedIds = accepted.map((r) => r.user_id);
      const { data: weekLogs } = await supabase
        .from("study_logs")
        .select("user_id, hours")
        .in("user_id", acceptedIds)
        .gte("logged_date", start)
        .lte("logged_date", end);

      const totals = {};
      (weekLogs || []).forEach((log) => {
        totals[log.user_id] = (totals[log.user_id] || 0) + Number(log.hours);
      });
      setWeekHoursByUser(totals);
    } else {
      setWeekHoursByUser({});
    }
  }

  useEffect(() => {
    loadFriendData();
    loadSquadData();
    const interval = setInterval(() => {
      loadFriendData();
      loadSquadData();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    setSearchError("");
    setSearchResults([]);
    if (!searchTerm.trim()) return;
    setSearching(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", `%${searchTerm.trim()}%`)
      .neq("id", session.user.id)
      .limit(10);

    if (error) setSearchError(error.message);
    setSearchResults(data || []);
    setSearching(false);
  }

  async function sendRequest(addresseeId) {
    setSearchError("");
    const { error } = await supabase.from("friendships").insert({
      requester_id: session.user.id,
      addressee_id: addresseeId,
      status: "pending",
    });
    if (error) {
      setSearchError(
        error.code === "23505" ? "You've already sent a request (or are already friends)." : error.message
      );
      return;
    }
    setSearchResults([]);
    setSearchTerm("");
    loadFriendData();
  }

  async function respondToRequest(friendshipId, accept) {
    if (accept) {
      await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    } else {
      await supabase.from("friendships").delete().eq("id", friendshipId);
    }
    loadFriendData();
  }

  async function removeFriend(friendshipId) {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    loadFriendData();
  }

  // ── Squad actions ──
  async function createSquad(e) {
    e.preventDefault();
    setSquadError("");
    if (!squadName.trim()) {
      setSquadError("Give your squad a name.");
      return;
    }
    setSquadBusy(true);

    const { data: party, error: partyErr } = await supabase
      .from("parties")
      .insert({ name: squadName.trim(), created_by: session.user.id })
      .select()
      .single();

    if (partyErr) {
      setSquadError(partyErr.message);
      setSquadBusy(false);
      return;
    }

    const { error: memberErr } = await supabase.from("party_members").insert({
      party_id: party.id,
      user_id: session.user.id,
      status: "accepted",
      invited_by: session.user.id,
    });

    if (memberErr) setSquadError(memberErr.message);

    setSquadName("");
    setSquadBusy(false);
    loadSquadData();
  }

  async function inviteFriendToSquad(friendUserId) {
    setSquadError("");
    if (!myMembership) return;
    const currentCount = squadMembers.length + squadPending.length;
    if (currentCount >= 5) {
      setSquadError("Squad is full (max 5).");
      return;
    }

    const { error } = await supabase.from("party_members").insert({
      party_id: myMembership.party_id,
      user_id: friendUserId,
      status: "invited",
      invited_by: session.user.id,
    });

    if (error) {
      setSquadError(
        error.code === "23505" ? "They're already in this squad." : error.message
      );
      return;
    }
    loadSquadData();
  }

  async function respondToSquadInvite(accept) {
    if (!myMembership) return;
    if (accept) {
      await supabase.from("party_members").update({ status: "accepted" }).eq("id", myMembership.id);
    } else {
      await supabase.from("party_members").delete().eq("id", myMembership.id);
    }
    loadSquadData();
  }

  async function leaveSquad() {
    if (!myMembership) return;
    const confirmed = window.confirm("Leave this squad? You'll stop contributing to its weekly boss.");
    if (!confirmed) return;
    await supabase.from("party_members").delete().eq("id", myMembership.id);
    loadSquadData();
  }

  const squadFull = squadMembers.length + squadPending.length >= 5;
  const invitableFriends = friends.filter(
    (f) => !squadMembers.some((m) => m.user_id === f.id) && !squadPending.some((m) => m.user_id === f.id)
  );

  return (
    <>
      <p className="zone-sub">Add friends, then see what they're up to here.</p>

      <form className="card" onSubmit={handleSearch}>
        <label htmlFor="friend-search">Find someone by name</label>
        <div className="log-row">
          <input
            id="friend-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Their display name"
          />
          <button type="submit" disabled={searching}>
            {searching ? "…" : "Search"}
          </button>
        </div>
        {searchError && <p className="error-text">{searchError}</p>}
        {searchResults.map((p) => (
          <div className="history-item" key={p.id}>
            <span>{p.display_name}</span>
            <button className="delete-btn" style={{ color: "#f2c879" }} onClick={() => sendRequest(p.id)}>
              Add friend
            </button>
          </div>
        ))}
      </form>

      {incoming.length > 0 && (
        <div className="card">
          <label>Friend requests</label>
          {incoming.map((f) => (
            <div className="history-item" key={f.friendshipId}>
              <span>{f.display_name}</span>
              <span>
                <button
                  className="delete-btn"
                  style={{ color: "#f2c879" }}
                  onClick={() => respondToRequest(f.friendshipId, true)}
                >
                  Accept
                </button>{" "}
                <button className="delete-btn" onClick={() => respondToRequest(f.friendshipId, false)}>
                  Decline
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="card">
          <label>Pending — waiting on them</label>
          {outgoing.map((f) => (
            <div className="history-item" key={f.friendshipId}>
              <span>{f.display_name}</span>
              <span className="history-date">Pending</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <label>Your party</label>
        {loading && <p className="zone-sub">Loading…</p>}
        {!loading && friends.length === 0 && (
          <p className="zone-sub" style={{ marginBottom: 0 }}>
            No friends yet — search for someone above to send a request.
          </p>
        )}
        {friends.map((f) => {
          const status = STATUS_LABELS[f.current_status] || STATUS_LABELS.idle;
          return (
            <div className="history-item" key={f.friendshipId}>
              <span>
                {status.icon} {f.display_name}
              </span>
              <span className="history-date">
                {status.label} · {timeAgo(f.status_updated_at)}
              </span>
              <button className="delete-btn" onClick={() => removeFriend(f.friendshipId)}>
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Squad / Weekly Boss ── */}
      {!myMembership && (
        <form className="card" onSubmit={createSquad}>
          <label htmlFor="squad-name">Start a squad (3–5 people) for the weekly boss</label>
          <div className="log-row">
            <input
              id="squad-name"
              value={squadName}
              onChange={(e) => setSquadName(e.target.value)}
              placeholder="Squad name"
            />
            <button type="submit" disabled={squadBusy}>
              {squadBusy ? "…" : "Create"}
            </button>
          </div>
          {squadError && <p className="error-text">{squadError}</p>}
        </form>
      )}

      {myMembership && myMembership.status === "invited" && (
        <div className="card">
          <label>Squad invite</label>
          <p className="zone-sub" style={{ marginBottom: 8 }}>
            You've been invited to join <strong>{myMembership.parties?.name}</strong>.
          </p>
          <div className="timer-controls">
            <button onClick={() => respondToSquadInvite(true)}>Accept</button>
            <button className="secondary" onClick={() => respondToSquadInvite(false)}>
              Decline
            </button>
          </div>
        </div>
      )}

      {myMembership && myMembership.status === "accepted" && (
        <BossHeader
          squadName={myMembership.parties?.name}
          squadMembers={squadMembers}
          squadPending={squadPending}
          weekHoursByUser={weekHoursByUser}
          myUserId={session.user.id}
          invitableFriends={invitableFriends}
          squadFull={squadFull}
          squadError={squadError}
          onInvite={inviteFriendToSquad}
          onLeave={leaveSquad}
        />
      )}
    </>
  );
}

function BossHeader({
  squadName,
  squadMembers,
  squadPending,
  weekHoursByUser,
  myUserId,
  invitableFriends,
  squadFull,
  squadError,
  onInvite,
  onLeave,
}) {
  const totalHours = squadMembers.reduce((sum, m) => sum + (weekHoursByUser[m.user_id] || 0), 0);
  const boss = getBossState(squadMembers.length, totalHours);
  const belowMinSize = squadMembers.length < 3;

  return (
    <div className="card">
      <div className="rank-line">
        <span className="rank-name">🗡 Weekly Boss — {squadName}</span>
        <span className="level-badge">{squadMembers.length} in squad</span>
      </div>

      {belowMinSize ? (
        <p className="zone-sub" style={{ marginBottom: 8 }}>
          Need at least 3 accepted members before the boss fight starts. Invite more friends below.
        </p>
      ) : (
        <>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${boss.percent}%`, background: boss.defeated ? "#7ee787" : undefined }}
            />
          </div>
          <div className="bar-caption">
            <span>
              {boss.defeated
                ? "Boss defeated this week! 🎉"
                : `${boss.hoursLogged.toFixed(1)} / ${boss.threshold} hrs`}
            </span>
            <span>{boss.hoursRemaining.toFixed(1)} hrs left</span>
          </div>
        </>
      )}

      <div style={{ marginTop: 12 }}>
        {squadMembers.map((m) => {
          const hrs = weekHoursByUser[m.user_id] || 0;
          const metFairShare = hrs >= 30;
          return (
            <div className="history-item" key={m.id}>
              <span>
                {m.profiles?.display_name}
                {m.user_id === myUserId ? " (you)" : ""}
              </span>
              <span className="history-date">
                {hrs.toFixed(1)} / 30 hrs {metFairShare ? "✅" : ""}
              </span>
            </div>
          );
        })}
        {squadPending.map((m) => (
          <div className="history-item" key={m.id}>
            <span style={{ opacity: 0.6 }}>{m.profiles?.display_name}</span>
            <span className="history-date">Invited — pending</span>
          </div>
        ))}
      </div>

      {squadError && <p className="error-text">{squadError}</p>}

      {!squadFull && invitableFriends.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <label>Invite a friend</label>
          {invitableFriends.map((f) => (
            <div className="history-item" key={f.id}>
              <span>{f.display_name}</span>
              <button className="delete-btn" style={{ color: "#f2c879" }} onClick={() => onInvite(f.id)}>
                Invite
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="secondary" style={{ marginTop: 12 }} onClick={onLeave}>
        Leave squad
      </button>
    </div>
  );
    }
    
