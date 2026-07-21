"use client";

import { useEffect, useState, useRef } from "react";
import { THEME_OPTIONS } from "@/lib/themes";
import { getRankStyle, getAvatarDisplay, RANK_TIERS, AVATAR_OPTIONS } from "@/lib/rankStyle";
import { getCurrentWeekRange, getBossState } from "@/lib/partySystem";
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


function Dashboard({ session, profile, logs, onLogged }) {
  const [zone, setZone] = useState("world");

  const totalExp = profile?.total_exp ?? 0;
  const progress = getProgressFromExp(totalExp);
  const rank = getCurrentRank(progress.level);
  const nextRank = getNextRank(progress.level);

  if (zone === "world") {
    return <WorldZone profile={profile} onNavigate={setZone} />;
  }

  return (
    <div className="page" data-theme={profile?.theme || "ember"}>
      <button className="secondary" onClick={() => setZone("world")} style={{ marginBottom: 16 }}>
        ← Back to map
      </button>

      <p className="brand">The Will of Focus</p>
      <h1 className="title" style={{ color: getRankStyle(rank.rank).color }}>
        <span style={{ marginRight: 8 }}>{getRankStyle(rank.rank).symbol}</span>
        {profile?.display_name || "Loading…"}
      </h1>

      {zone === "dorm" && (
        <DormZone progress={progress} rank={rank} nextRank={nextRank} totalExp={totalExp} />
      )}

      {zone === "study" && (
        <StudyZone session={session} totalExp={totalExp} logs={logs} onLogged={onLogged} />
      )}

      {zone === "break" && <BreakZone session={session} />}

      {zone === "party" && <PartyZone session={session} />}

      {zone === "profile" && <ProfileZone session={session} profile={profile} onUpdated={onLogged} />}

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
  const presetAvatar = getAvatarDisplay(profile?.avatar_id);
  const hasUploadedPhoto = Boolean(profile?.avatar_url);
  const currentTheme = profile?.theme || "ember";

  async function chooseAvatar(id) {
    setError("");
    setSaving(true);
    // Picking a preset clears any uploaded photo, so the preset actually shows.
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_id: id, avatar_url: null })
      .eq("id", session.user.id);
    if (error) setError(error.message);
    setSaving(false);
    onUpdated();
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }

    setSaving(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${session.user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setError(uploadError.message);
      setSaving(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: bustedUrl })
      .eq("id", session.user.id);

    if (updateError) setError(updateError.message);
    setSaving(false);
    onUpdated();
  }

  async function removePhoto() {
    setError("");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", session.user.id);
    if (error) setError(error.message);
    setSaving(false);
    onUpdated();
  }

  async function chooseTheme(id) {
    setError("");
    const { error } = await supabase.from("profiles").update({ theme: id }).eq("id", session.user.id);
    if (error) setError(error.message);
    onUpdated();
  }

  return (
    <>
      <p className="zone-sub">Your public card — this is what friends see.</p>

      <div className="card" style={{ textAlign: "center" }}>
        {hasUploadedPhoto ? (
          <img
            src={profile.avatar_url}
            alt="Your profile photo"
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              objectFit: "cover",
              margin: "0 auto 8px",
              border: `2px solid ${style.color}`,
            }}
          />
        ) : (
          <div style={{ fontSize: 64, marginBottom: 8 }}>{presetAvatar}</div>
        )}

        <div style={{ fontSize: 22, fontWeight: 700, color: style.color }}>
          <span style={{ marginRight: 6 }}>{style.symbol}</span>
          {profile?.display_name}
        </div>
        <p className="zone-sub" style={{ marginTop: 4, marginBottom: 0 }}>
          {style.tierName} tier · {rank.name} · Level {progress.level}
        </p>
      </div>

      <div className="card">
        <label>Upload a photo</label>
        <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={saving} />
        {hasUploadedPhoto && (
          <button className="secondary" onClick={removePhoto} disabled={saving} style={{ marginTop: 8 }}>
            Remove photo (use preset instead)
          </button>
        )}
      </div>

      <div className="card">
        <label>Or choose a preset pfp</label>
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
                border:
                  !hasUploadedPhoto && presetAvatar === id
                    ? "2px solid #f2c879"
                    : "1px solid rgba(255,255,255,0.15)",
                background: !hasUploadedPhoto && presetAvatar === id ? "rgba(242,200,121,0.12)" : "transparent",
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
        <label>App theme</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.id}
              className={currentTheme === t.id ? "" : "secondary"}
              onClick={() => chooseTheme(t.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10 }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: t.swatch,
                  display: "inline-block",
                }}
              />
              {t.label}
            </button>
          ))}
        </div>
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

// ── Phase 2: fullscreen world, analog joystick, doors that navigate
// straight into your existing Study/Break/Party/Profile tabs. ──

const DOORS = [
  { id: "study", label: "📖 Study", fx: 0.5, fy: 0.15 },
  { id: "break", label: "☕ Break", fx: 0.15, fy: 0.5 },
  { id: "party", label: "👥 Party", fx: 0.85, fy: 0.5 },
  { id: "profile", label: "🪪 Profile", fx: 0.5, fy: 0.85 },
];
const DOOR_SIZE = 64;


  // ── Phase 2b: pixel-art hub, 5 buildings w/ signboards, no tab bar.
// World is now the home screen; walking to a building's door navigates
// straight into that real zone. ──

const BUILDINGS = [
  { id: "dorm", label: "🛏 Dorm", sprite: "/sprites/building_dorm.png", fx: 0.5, fy: 0.18 },
  { id: "study", label: "📖 Study", sprite: "/sprites/building_study.png", fx: 0.2, fy: 0.4 },
  { id: "break", label: "☕ Break", sprite: "/sprites/building_break.png", fx: 0.8, fy: 0.4 },
  { id: "party", label: "👥 Party", sprite: "/sprites/building_party.png", fx: 0.25, fy: 0.78 },
  { id: "profile", label: "🪪 Profile", sprite: "/sprites/building_profile.png", fx: 0.75, fy: 0.78 },
];
const BUILDING_W = 80;
const BUILDING_H = 100;
const DOOR_HIT_W = 30;
const DOOR_HIT_H = 24;

function Joystick({ onChange }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const centerRef = useRef({ x: 0, y: 0 });
  const RADIUS = 42;

  function handlePointerDown(e) {
    const rect = baseRef.current.getBoundingClientRect();
    centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    draggingRef.current = true;
    baseRef.current.setPointerCapture(e.pointerId);
    handlePointerMove(e);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    let dx = e.clientX - centerRef.current.x;
    let dy = e.clientY - centerRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS;
      dy = (dy / dist) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    onChange({ x: dx / RADIUS, y: dy / RADIUS });
  }

  function handlePointerUp() {
    draggingRef.current = false;
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  }

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: "absolute",
        left: 28,
        bottom: 36,
        width: 96,
        height: 96,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.10)",
        border: "2px solid rgba(255,255,255,0.25)",
        touchAction: "none",
        zIndex: 2,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 48 + knob.x - 21,
          top: 48 + knob.y - 21,
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.85)",
        }}
      />
    </div>
  );
}

function WorldZone({ profile, onNavigate }) {
  const canvasRef = useRef(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const joystickRef = useRef({ x: 0, y: 0 });
  const playerRef = useRef({ x: 100, y: 100 });
  const avatarImgRef = useRef(null);
  const grassPatternRef = useRef(null);
  const pathPatternRef = useRef(null);
  const buildingImgsRef = useRef({});
  const assetsReadyRef = useRef(false);
  const lastDoorRef = useRef(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const [dims, setDims] = useState({ width: 360, height: 600 });
  const PLAYER_SIZE = 26;
  const SPEED = 180;
  const WALL_THICKNESS = 14;

  useEffect(() => {
    function updateDims() {
      setDims({ width: window.innerWidth, height: window.innerHeight });
    }
    updateDims();
    window.addEventListener("resize", updateDims);
    return () => window.removeEventListener("resize", updateDims);
  }, []);

  useEffect(() => {
    if (profile?.avatar_url) {
      const img = new Image();
      img.src = profile.avatar_url;
      img.onload = () => {
        avatarImgRef.current = img;
      };
    } else {
      avatarImgRef.current = null;
    }
  }, [profile?.avatar_url]);

  // Load grass tile + all building sprites once
  useEffect(() => {
    let loaded = 0;
    const total = 2 + BUILDINGS.length;
    function markLoaded() {
      loaded += 1;
      if (loaded >= total) assetsReadyRef.current = true;
    }

    const grassImg = new Image();
    grassImg.src = "/sprites/grass.png";
    grassImg.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas ? canvas.getContext("2d") : null;
      if (ctx) grassPatternRef.current = ctx.createPattern(grassImg, "repeat");
      markLoaded();
    };

    const pathImg = new Image();
    pathImg.src = "/sprites/path.png";
    pathImg.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas ? canvas.getContext("2d") : null;
      if (ctx) pathPatternRef.current = ctx.createPattern(pathImg, "repeat");
      markLoaded();
    };

    BUILDINGS.forEach((b) => {
      const img = new Image();
      img.src = b.sprite;
      img.onload = () => {
        buildingImgsRef.current[b.id] = img;
        markLoaded();
      };
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (["ArrowUp", "w", "W"].includes(e.key)) keysRef.current.up = true;
      if (["ArrowDown", "s", "S"].includes(e.key)) keysRef.current.down = true;
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = true;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = true;
    }
    function handleKeyUp(e) {
      if (["ArrowUp", "w", "W"].includes(e.key)) keysRef.current.up = false;
      if (["ArrowDown", "s", "S"].includes(e.key)) keysRef.current.down = false;
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = false;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    canvas.width = dims.width;
    canvas.height = dims.height;

    playerRef.current.x = Math.max(0, Math.min(dims.width - PLAYER_SIZE, playerRef.current.x));
    playerRef.current.y = Math.max(0, Math.min(dims.height - PLAYER_SIZE, playerRef.current.y));

    const WALLS = [
      { x: 0, y: 0, w: dims.width, h: WALL_THICKNESS },
      { x: 0, y: dims.height - WALL_THICKNESS, w: dims.width, h: WALL_THICKNESS },
      { x: 0, y: 0, w: WALL_THICKNESS, h: dims.height },
      { x: dims.width - WALL_THICKNESS, y: 0, w: WALL_THICKNESS, h: dims.height },
    ];

    const buildingRects = BUILDINGS.map((b) => {
      const cx = b.fx * dims.width;
      const cy = b.fy * dims.height;
      return {
        ...b,
        drawX: cx - BUILDING_W / 2,
        drawY: cy - BUILDING_H / 2,
        // Solid body blocks walking through the building itself
        solid: { x: cx - BUILDING_W / 2 + 6, y: cy - BUILDING_H / 2, w: BUILDING_W - 12, h: BUILDING_H - 16 },
        // Door hotspot at the base — this is what actually triggers navigation
        door: { x: cx - DOOR_HIT_W / 2, y: cy + BUILDING_H / 2 - DOOR_HIT_H, w: DOOR_HIT_W, h: DOOR_HIT_H },
      };
    });

    function rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    let animationFrameId;
    let lastTime = performance.now();

    function tick(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      let dx = 0;
      let dy = 0;
      if (keysRef.current.up) dy -= 1;
      if (keysRef.current.down) dy += 1;
      if (keysRef.current.left) dx -= 1;
      if (keysRef.current.right) dx += 1;
      dx += joystickRef.current.x;
      dy += joystickRef.current.y;

      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.05) {
        const normX = (dx / len) * Math.min(len, 1) * SPEED * dt;
        const normY = (dy / len) * Math.min(len, 1) * SPEED * dt;

        const p = playerRef.current;
        const solids = [...WALLS, ...buildingRects.map((b) => b.solid)];
        const tryMove = (nx, ny) => {
          const box = { x: nx, y: ny, w: PLAYER_SIZE, h: PLAYER_SIZE };
          return !solids.some((s) => rectsOverlap(box, s));
        };
        if (tryMove(p.x + normX, p.y)) p.x += normX;
        if (tryMove(p.x, p.y + normY)) p.y += normY;

        p.x = Math.max(0, Math.min(dims.width - PLAYER_SIZE, p.x));
        p.y = Math.max(0, Math.min(dims.height - PLAYER_SIZE, p.y));
      }

      const p = playerRef.current;
      const playerBox = { x: p.x, y: p.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
      const hitDoor = buildingRects.find((b) => rectsOverlap(playerBox, b.door));
      if (hitDoor && lastDoorRef.current !== hitDoor.id) {
        lastDoorRef.current = hitDoor.id;
        onNavigateRef.current(hitDoor.id);
        return;
      }
      if (!hitDoor) lastDoorRef.current = null;

      // ── Draw ──
      if (grassPatternRef.current) {
        ctx.fillStyle = grassPatternRef.current;
        ctx.fillRect(0, 0, dims.width, dims.height);
      } else {
        ctx.fillStyle = "#3a6035";
        ctx.fillRect(0, 0, dims.width, dims.height);
      }

      ctx.fillStyle = "#4a3728";
      WALLS.forEach((w) => ctx.fillRect(w.x, w.y, w.w, w.h));

      if (pathPatternRef.current) {
        ctx.fillStyle = pathPatternRef.current;
        buildingRects.forEach((b) => {
          ctx.fillRect(b.door.x - 10, b.door.y, b.door.w + 20, 40);
        });
      }
      
      buildingRects.forEach((b) => {
        const img = buildingImgsRef.current[b.id];
        if (img) {
          ctx.drawImage(img, b.drawX, b.drawY, BUILDING_W, BUILDING_H);
        } else {
          ctx.fillStyle = "#8a6642";
          ctx.fillRect(b.drawX, b.drawY, BUILDING_W, BUILDING_H);
        }

        // Signboard
        const signY = b.drawY + BUILDING_H + 6;
        ctx.font = "bold 12px monospace";
        const textWidth = ctx.measureText(b.label).width;
        const signW = textWidth + 16;
        const signX = b.drawX + BUILDING_W / 2 - signW / 2;
        ctx.fillStyle = "#caa06a";
        ctx.fillRect(signX, signY, signW, 20);
        ctx.strokeStyle = "#5a4028";
        ctx.lineWidth = 2;
        ctx.strokeRect(signX, signY, signW, 20);
        ctx.fillStyle = "#2a1e14";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.label, b.drawX + BUILDING_W / 2, signY + 10);
      });
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      if (avatarImgRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, PLAYER_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImgRef.current, p.x, p.y, PLAYER_SIZE, PLAYER_SIZE);
        ctx.restore();
      } else {
        ctx.font = `${PLAYER_SIZE}px sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(profile?.avatar_id || "🧑‍🎓", p.x, p.y);
        ctx.textBaseline = "alphabetic";
      }

      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#f2c879";
      ctx.fillText(profile?.display_name || "You", p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE + 14);
      ctx.textAlign = "left";

      animationFrameId = requestAnimationFrame(tick);
    }

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [dims, profile?.avatar_id, profile?.display_name]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#3a6035" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <Joystick onChange={(v) => (joystickRef.current = v)} />
    </div>
  );
}
