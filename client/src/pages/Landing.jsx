import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { getUser } from "../services/auth";

export default function Landing() {
  const navigate = useNavigate();
  const user = getUser();

  const handleCreateRoomClick = (e) => {
    if (user) {
      e.preventDefault();
      toast.success("Welcome back! Redirecting to dashboard...");
      navigate("/dashboard");
    }
  };

  return (
    <main className="min-h-screen px-6 py-6">
      <div className="mx-auto w-full max-w-6xl">
        <nav className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-[var(--text-h)]">
            <LogoMark />
            WatchParty
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[#1A1206] transition-opacity hover:opacity-90"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-h)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[#1A1206] transition-opacity hover:opacity-90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>

        <section className="grid min-h-[78vh] grid-cols-1 items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
          <div className="hero-in max-w-xl">
            <span className="mb-6 inline-block rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">
              Synced YouTube playback for up to 50 people
            </span>

            <h1 className="!mb-6 font-serif !text-5xl !font-normal leading-[1.05] text-[var(--text-h)] md:!text-6xl">
              Press play once.
              <br />
              Everyone sees it together.
            </h1>

            <p className="max-w-md text-lg leading-relaxed text-[var(--text-body)]">
              Open a room, share the link, and watch YouTube videos in
              lockstep — every play, pause, and seek mirrors across the
              whole group in real time.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to={user ? "/dashboard" : "/register"}
                onClick={handleCreateRoomClick}
                className="rounded-lg bg-[var(--accent)] px-6 py-3 font-medium text-[#1A1206] transition-opacity hover:opacity-90"
              >
                Create a room
              </Link>
              {!user && (
                <Link
                  to="/login"
                  className="rounded-lg border border-[var(--border)] px-6 py-3 font-medium text-[var(--text-h)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  I have an account
                </Link>
              )}
            </div>

            <dl className="mt-14 grid grid-cols-3 gap-6 border-t border-[var(--border)] pt-6">
              <Stat term="Playback drift" desc="Under 200ms" />
              <Stat term="Room control" desc="Host & mods" />
              <Stat term="Transport" desc="Socket.IO" />
            </dl>
          </div>

          <RoomPreview />
        </section>
      </div>
    </main>
  );
}

function Stat({ term, desc }) {
  return (
    <div>
      <dt className="text-sm text-[var(--text-muted)]">{term}</dt>
      <dd className="mt-1 font-serif text-lg text-[var(--text-h)]">{desc}</dd>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M10 8.5L15.5 12L10 15.5V8.5Z" fill="var(--accent)" />
    </svg>
  );
}

function RoomPreview() {
  return (
    <div className="hero-in relative mx-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl">
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="text-sm text-[var(--text-muted)]">Room · Movie Night</span>
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--accent-2)]">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-2)]" />
          Live
        </span>
      </div>

      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#241F35] to-[#151222]">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="opacity-70">
          <path d="M9 7L18 12L9 17V7Z" fill="var(--text-h)" />
        </svg>
      </div>

      <div className="mt-4 px-1">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-[var(--accent-2)]" />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            <Avatar initial="A" />
            <Avatar initial="R" />
            <Avatar initial="+3" />
          </div>
          <span className="text-xs text-[var(--text-muted)]">14:02 / 21:11</span>
        </div>
      </div>
    </div>
  );
}

function Avatar({ initial }) {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-2)] text-[10px] font-medium text-[var(--text-h)]">
      {initial}
    </div>
  );
}