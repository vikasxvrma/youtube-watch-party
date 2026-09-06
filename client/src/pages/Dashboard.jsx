import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { clearAuth, getSavedRoom, getUser, saveRoom } from "../services/auth";
import socket, { connectSocket, disconnectSocket } from "../services/socket";

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();

  const [createInput, setCreateInput] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const savedRoom = getSavedRoom();

  useEffect(() => {
    connectSocket();

    const handleRoomCreated = (data) => {
      if (!data?.roomId) return;
      saveRoom(data.roomId);
      setLoading(false);
      toast.success(`Room created! Redirecting...`);
      navigate(`/room/${data.roomId}`, { replace: true });
    };

    const handleError = (data) => {
      setLoading(false);
      const errMsg = data?.message || "Something went wrong.";
      setError(errMsg);
      toast.error(errMsg);
    };

    socket.on("room_created", handleRoomCreated);
    socket.on("error_message", handleError);

    return () => {
      socket.off("room_created", handleRoomCreated);
      socket.off("error_message", handleError);
    };
  }, [navigate]);

  const createRoom = () => {
    setError("");
    setMessage("");

    const value = createInput.trim();
    if (!value) {
      toast.error("Enter a room ID to create a watch party.");
      return;
    }

    setLoading(true);
    socket.emit("create_room", { roomId: value });
  };

  const joinRoom = () => {
    setError("");
    setMessage("");

    const value = joinInput.trim();
    if (!value) {
      toast.error("Enter a room ID to join.");
      return;
    }

    saveRoom(value);
    navigate(`/room/${value}`);
  };

  const logout = () => {
    disconnectSocket();
    clearAuth();
    toast.success("Logged out successfully");
    navigate("/login", { replace: true });
  };

  return (
    <main className="min-h-screen px-6">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between border-b border-[var(--border)] py-5">
          <Link
            to="/dashboard"
            className="text-xl font-bold text-[var(--text-h)]"
          >
            WatchParty
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-[var(--text-h)]">
                {user?.name || "User"}
              </p>
              <p className="text-xs opacity-50">{user?.email}</p>
            </div>

            <button
              onClick={logout}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm transition hover:bg-[var(--code-bg)]"
            >
              Logout
            </button>
          </div>
        </nav>

        <section className="py-14">
          <p className="mb-3 text-sm font-medium opacity-50">
            YOUR WATCH PARTY
          </p>
          <h1 className="!mb-4 !text-4xl !font-bold md:!text-6xl">
            Watch something <br /> together.
          </h1>
          <p className="max-w-2xl text-lg opacity-60">
            Create a room for your friends or join an existing watch party using
            its room ID.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] p-6">
            <div className="mb-6">
              <span className="mb-3 inline-flex rounded-lg bg-[var(--code-bg)] px-3 py-1 text-xs font-medium">
                HOST
              </span>
              <h2 className="!mt-2 !text-2xl !font-bold">Create a room</h2>
              <p className="mt-2 text-sm opacity-60">
                Start a new watch party and control playback.
              </p>
            </div>

            <label htmlFor="create-room-input" className="sr-only">
              Create Room ID
            </label>
            <input
              id="create-room-input"
              value={createInput}
              onChange={(e) => setCreateInput(e.target.value)}
              placeholder="e.g. friday-night"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 outline-none transition focus:border-[var(--text-h)]"
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
            />

            <button
              onClick={createRoom}
              disabled={loading}
              className="mt-3 w-full rounded-xl bg-[var(--text-h)] px-4 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Create Watch Party"}
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-6">
            <div className="mb-6">
              <span className="mb-3 inline-flex rounded-lg bg-[var(--code-bg)] px-3 py-1 text-xs font-medium">
                PARTICIPANT
              </span>
              <h2 className="!mt-2 !text-2xl !font-bold">Join a room</h2>
              <p className="mt-2 text-sm opacity-60">
                Enter a room ID shared by your host.
              </p>
            </div>

            <label htmlFor="join-room-input" className="sr-only">
              Join Room ID
            </label>
            <input
              id="join-room-input"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Enter room ID"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 outline-none transition focus:border-[var(--text-h)]"
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            />

            <button
              onClick={joinRoom}
              disabled={loading}
              className="mt-3 w-full rounded-xl border border-[var(--border)] px-4 py-3 font-medium transition hover:bg-[var(--code-bg)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join Watch Party"}
            </button>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600"
          >
            {message}
          </div>
        )}

        {savedRoom && (
          <section className="mt-8 rounded-2xl border border-[var(--border)] p-5">
            <p className="text-xs font-medium uppercase tracking-wide opacity-50">
              Previous room
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-lg font-semibold text-[var(--text-h)]">
                  {savedRoom}
                </p>
                <p className="text-sm opacity-50">Your last watch party</p>
              </div>

              <button
                onClick={() => navigate(`/room/${savedRoom}`)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm transition hover:bg-[var(--code-bg)]"
              >
                Reopen Room
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}