import { useCallback, useEffect, useMemo, useRef, useState, } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import YouTubePlayer from "../components/YouTubePlayer";
import { clearSavedRoom, getUser,saveRoom,} from "../services/auth";
import socket, { connectSocket } from "../services/socket";

export default function WatchRoom() {
    const { roomId: routeRoomId } = useParams();
    const navigate = useNavigate();

    const user = getUser();

    const roomId = useMemo(
        () => routeRoomId?.trim(),
        [routeRoomId]
    );

    const [myUserId, setMyUserId] = useState(user?.id ?? null);
    const [role, setRole] = useState(null);
    const [videoId, setVideoId] = useState(null);
    const [playState, setPlayState] = useState("paused");
    const [currentTime, setCurrentTime] = useState(0);
    const [participants, setParticipants] = useState([]);
    const [videoInput, setVideoInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [connected, setConnected] = useState(socket.connected);
    const [leaving, setLeaving] = useState(false);

    const joinedRoomIdRef = useRef(null);
    const canControl = role === "Host" || role === "Moderator";

    const updateMyRoleFromList = useCallback((participantList, currentUserId) => {
        if (!currentUserId || !participantList?.length) return;
        const me = participantList.find(
            (p) => Number(p.userId) === Number(currentUserId)
        );
        if (me) setRole(me.role);
    }, []);

    const extractVideoId = useCallback((input) => {
        const value = input.trim();
        if (!value) return null;
        if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

        try {
            const url = new URL(value);
            const queryId = url.searchParams.get("v");
            if (queryId && /^[a-zA-Z0-9_-]{11}$/.test(queryId)) return queryId;

            if (url.hostname.includes("youtu.be")) {
                const id = url.pathname.split("/").filter(Boolean)[0];
                if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
            }

            const match = url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/);
            if (match && /^[a-zA-Z0-9_-]{11}$/.test(match[1])) return match[1];
        } catch {
            return null;
        }
        return null;
    }, []);

    useEffect(() => {
        if (!roomId) {
            toast.error("Invalid room ID");
            navigate("/dashboard", { replace: true });
            return;
        }

        saveRoom(roomId);

        const emitJoinIfNeeded = () => {
            if (joinedRoomIdRef.current !== roomId && socket.connected) {
                joinedRoomIdRef.current = roomId;
                setLoading(true);
                setError("");
                socket.emit("join_room", { roomId });
            }
        };

        const handleConnect = () => {
            setConnected(true);
            joinedRoomIdRef.current = null;
            emitJoinIfNeeded();
        };

        const handleDisconnect = () => {
            setConnected(false);
            toast.error("Disconnected from server. Reconnecting...");
        };

        const handleRoomCreated = (data) => {
            if (!data) return;
            if (data.userId) setMyUserId(data.userId);
            setRole(data.role || "Host");
            setVideoId(data.videoId ?? null);
            setPlayState(data.playState ?? "paused");
            setCurrentTime(data.currentTime ?? 0);
            setParticipants(data.participants ?? []);
            setLoading(false);
            setError("");
            saveRoom(roomId);
        };

        const handleUserJoined = (data) => {
            if (data?.roomId && data.roomId !== roomId) return;
            const list = data?.participants ?? [];
            setParticipants(list);

            // Use the local user object or state directly instead of inside setState callback
            const currentUserId = user?.id || myUserId;
            const isMe = Number(data?.userId) === Number(currentUserId);

            if (isMe) {
                if (data?.role) setRole(data.role);
                toast.success("Joined watch room!");
            } else {
                updateMyRoleFromList(list, currentUserId);
                const newMember = list.find((p) => Number(p.userId) === Number(data?.userId));
                if (newMember?.username) {
                    toast(`${newMember.username} joined the room`, { icon: "👋" });
                }
            }

            setLoading(false);
            setError("");
            saveRoom(roomId);
        };

        const handleUserLeft = (data) => {
            const list = data?.participants ?? [];
            setParticipants((prevList) => {
                const leftMember = prevList.find((p) => Number(p.userId) === Number(data?.userId));
                if (leftMember?.username) {
                    toast(`${leftMember.username} left the room`, { icon: "🚪" });
                }
                return list;
            });

            setMyUserId((currentId) => {
                updateMyRoleFromList(list, currentId);
                return currentId;
            });
        };

        const handleSyncState = (data) => {
            if (!data) return;
            if (data.userId) setMyUserId(data.userId);
            if (data.role) setRole(data.role);
            setVideoId(data.videoId ?? null);
            setPlayState(data.playState ?? "paused");
            setCurrentTime(typeof data.currentTime === "number" ? data.currentTime : 0);
            setParticipants(data.participants ?? []);
            setLoading(false);
            setError("");
            saveRoom(roomId);
        };

        const handlePlay = (data) => {
            setPlayState("playing");
            if (typeof data?.currentTime === "number") setCurrentTime(data.currentTime);
        };

        const handlePause = (data) => {
            setPlayState("paused");
            if (typeof data?.time === "number") setCurrentTime(data.time);
        };

        const handleSeek = (data) => {
            if (typeof data?.time === "number") setCurrentTime(data.time);
        };

        const handleVideoChange = (data) => {
            if (!data?.videoId) return;
            setVideoId(data.videoId);
            setCurrentTime(0);
            setPlayState("paused");
            toast.success("Video updated");
        };

        const handleRoleAssigned = (data) => {
            const list = data?.participants ?? [];
            setParticipants(list);

            setMyUserId((currentId) => {
                updateMyRoleFromList(list, currentId);
                if (Number(data?.userId) === Number(currentId) && data?.role) {
                    setRole(data.role);
                    toast.success(`Your role changed to ${data.role}`);
                } else {
                    const updatedUser = list.find((p) => Number(p.userId) === Number(data?.userId));
                    if (updatedUser) {
                        toast(`${updatedUser.username} is now ${data.role}`);
                    }
                }
                return currentId;
            });
        };

        const handleParticipantRemoved = (data) => {
            const list = data?.participants ?? [];
            setParticipants((prevList) => {
                const removedUser = prevList.find((p) => Number(p.userId) === Number(data?.userId));
                if (removedUser?.username) {
                    toast(`${removedUser.username} was removed`);
                }
                return list;
            });

            setMyUserId((currentId) => {
                updateMyRoleFromList(list, currentId);
                return currentId;
            });
        };

        const handleRoomDeleted = () => {
            clearSavedRoom();
            joinedRoomIdRef.current = null;
            toast.error("This room has been deleted by the host");
            navigate("/dashboard", { replace: true });
        };

        const handleRemovedFromRoom = () => {
            clearSavedRoom();
            joinedRoomIdRef.current = null;
            toast.error("You were removed from the room");
            navigate("/dashboard", { replace: true });
        };

        const handleLeftRoom = () => {
            clearSavedRoom();
            joinedRoomIdRef.current = null;
            setLeaving(false);
            toast.success("Left the room");
            navigate("/dashboard", { replace: true });
        };

        const handleError = (data) => {
            const message = data?.message || "Something went wrong.";
            if (
                message.toLowerCase().includes("room does not exist") ||
                message.toLowerCase().includes("room not found")
            ) {
                clearSavedRoom();
            }
            setLoading(false);
            setLeaving(false);
            setError(message);
            toast.error(message);
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("room_created", handleRoomCreated);
        socket.on("user_joined", handleUserJoined);
        socket.on("user_left", handleUserLeft);
        socket.on("sync_state", handleSyncState);
        socket.on("play", handlePlay);
        socket.on("pause", handlePause);
        socket.on("seek", handleSeek);
        socket.on("change_video", handleVideoChange);
        socket.on("role_assigned", handleRoleAssigned);
        socket.on("participant_removed", handleParticipantRemoved);
        socket.on("room_deleted", handleRoomDeleted);
        socket.on("removed_from_room", handleRemovedFromRoom);
        socket.on("left_room", handleLeftRoom);
        socket.on("error_message", handleError);

        if (socket.connected) {
            emitJoinIfNeeded();
        } else {
            connectSocket();
        }

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("room_created", handleRoomCreated);
            socket.off("user_joined", handleUserJoined);
            socket.off("user_left", handleUserLeft);
            socket.off("sync_state", handleSyncState);
            socket.off("play", handlePlay);
            socket.off("pause", handlePause);
            socket.off("seek", handleSeek);
            socket.off("change_video", handleVideoChange);
            socket.off("role_assigned", handleRoleAssigned);
            socket.off("participant_removed", handleParticipantRemoved);
            socket.off("room_deleted", handleRoomDeleted);
            socket.off("removed_from_room", handleRemovedFromRoom);
            socket.off("left_room", handleLeftRoom);
            socket.off("error_message", handleError);
        };
    }, [roomId, navigate, updateMyRoleFromList]);

    const handlePlay = useCallback((time) => {
        if (!canControl) return;
        socket.emit("play", { currentTime: time });
    }, [canControl]);

    const handlePause = useCallback((time) => {
        if (!canControl) return;
        socket.emit("pause", { time });
    }, [canControl]);

    const handleSeek = useCallback((time) => {
        if (!canControl) return;
        socket.emit("seek", { time });
    }, [canControl]);

    const changeVideo = useCallback(() => {
        if (!canControl) return;
        const id = extractVideoId(videoInput);
        if (!id) {
            toast.error("Please enter a valid YouTube URL or video ID.");
            return;
        }
        setError("");
        socket.emit("change_video", { videoId: id });
        setVideoInput("");
    }, [canControl, extractVideoId, videoInput]);

    const updateRole = useCallback((targetUserId, targetRole) => {
        if (role !== "Host") return;
        if (targetRole === "Host") {
            const confirmTransfer = window.confirm("Transfer Host status? You will become a Participant.");
            if (!confirmTransfer) return;
        }
        socket.emit("assign_role", { userId: Number(targetUserId), role: targetRole });
    }, [role]);

    const removeParticipant = useCallback((targetUserId) => {
        if (role !== "Host") return;
        if (Number(targetUserId) === Number(myUserId)) return;
        socket.emit("remove_participant", { userId: Number(targetUserId) });
    }, [role, myUserId]);

    const leaveRoom = useCallback(() => {
        if (leaving) return;
        if (role === "Host" && participants.length > 1) {
            toast.error("Transfer host status or delete the room before leaving.");
            return;
        }
        setLeaving(true);
        socket.emit("leave_room");
    }, [leaving, role, participants.length]);

    const deleteRoom = useCallback(() => {
        if (role !== "Host") return;
        const confirmDelete = window.confirm("Are you sure you want to delete this room for everyone?");
        if (!confirmDelete) return;

        socket.emit("delete_room", { roomId });
    }, [role, roomId]);

    return (
        <main className="min-h-screen px-4 pb-10">
            <div className="mx-auto max-w-6xl">
                <Header
                    user={user}
                    role={role}
                    connected={connected}
                    leaving={leaving}
                    onLeave={leaveRoom}
                    onDelete={deleteRoom}
                    onNavigateDashboard={() => navigate("/dashboard")}
                />

                <RoomInfo roomId={roomId} role={role} />

                {error && (
                    <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {loading ? (
                    <LoadingState />
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <section>
                            <YouTubePlayer
                                videoId={videoId}
                                playState={playState}
                                currentTime={currentTime}
                                canControl={canControl}
                                onPlay={handlePlay}
                                onPause={handlePause}
                                onSeek={handleSeek}
                            />

                            {canControl && (
                                <ChangeVideoForm
                                    videoInput={videoInput}
                                    setVideoInput={setVideoInput}
                                    onChangeVideo={changeVideo}
                                />
                            )}
                        </section>

                        <aside className="rounded-2xl border border-[var(--border)] p-5">
                            <ParticipantList
                                participants={participants}
                                myUserId={myUserId}
                                currentRole={role}
                                onUpdateRole={updateRole}
                                onRemoveParticipant={removeParticipant}
                            />
                        </aside>
                    </div>
                )}
            </div>
        </main>
    );
}

function Header({
    user,
    role,
    connected,
    leaving,
    onLeave,
    onDelete,
    onNavigateDashboard,
}) {
    return (
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-5">
            <div>
                <button
                    type="button"
                    onClick={onNavigateDashboard}
                    className="mb-2 text-sm opacity-50 hover:opacity-100"
                >
                    ← Dashboard
                </button>
                <h1 className="!m-0 !text-2xl !font-bold">Watch Party</h1>
            </div>

            <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                    <p className="text-sm font-medium text-[var(--text-h)]">
                        {user?.name}
                    </p>
                    <p className="text-xs opacity-50">{role || "Joining..."}</p>
                </div>

                <ConnectionBadge connected={connected} />

                {role === "Host" && (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 transition hover:bg-red-500/20"
                    >
                        Delete Room
                    </button>
                )}

                <button
                    type="button"
                    onClick={onLeave}
                    disabled={leaving}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm transition hover:bg-[var(--code-bg)] disabled:opacity-50"
                >
                    {leaving ? "Leaving..." : "Leave Room"}
                </button>
            </div>
        </header>
    );
}

function RoomInfo({ roomId, role }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4 py-6">
            <div>
                <p className="text-xs uppercase tracking-wider opacity-50">Room</p>
                <div className="mt-1 flex items-center gap-3">
                    <code className="!bg-[var(--code-bg)] !text-lg">{roomId}</code>
                    {role && (
                        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">
                            {role}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function ChangeVideoForm({ videoInput, setVideoInput, onChangeVideo }) {
    return (
        <div className="mt-4 rounded-2xl border border-[var(--border)] p-4">
            <p className="mb-3 text-sm font-medium text-[var(--text-h)]">
                Change video
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    value={videoInput}
                    onChange={(e) => setVideoInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onChangeVideo()}
                    placeholder="Paste YouTube URL or video ID"
                    className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 outline-none focus:border-[var(--text-h)]"
                />

                <button
                    type="button"
                    onClick={onChangeVideo}
                    className="rounded-xl bg-[var(--accent)] px-5 py-3 font-medium text-[#14121F] transition opacity-90 hover:opacity-100"
                >
                    Change
                </button>
            </div>
        </div>
    );
}

function ParticipantList({
    participants,
    myUserId,
    currentRole,
    onUpdateRole,
    onRemoveParticipant,
}) {
    return (
        <>
            <div className="flex items-center justify-between">
                <h2 className="!m-0 !text-lg !font-bold">Participants</h2>
                <span className="rounded-full bg-[var(--code-bg)] px-2.5 py-1 text-xs">
                    {participants.length}
                </span>
            </div>

            <div className="mt-5 space-y-2">
                {participants.map((participant) => {
                    const isMe = Number(participant.userId) === Number(myUserId);
                    const isHost = participant.role === "Host";
                    const isMod = participant.role === "Moderator";
                    const isOnline = participant.isOnline !== false;

                    return (
                        <div
                            key={participant.userId}
                            className="rounded-xl border border-[var(--border)] p-3"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-400"
                                                }`}
                                            title={isOnline ? "Online" : "Offline"}
                                        />
                                        <p className="truncate text-sm font-medium text-[var(--text-h)]">
                                            {participant.username}
                                            {isMe && " (You)"}
                                        </p>
                                    </div>

                                    <p className="mt-0.5 text-xs opacity-50">
                                        {participant.role} • {isOnline ? "Online" : "Offline"}
                                    </p>
                                </div>

                                {isHost && <span className="text-xs opacity-50">Host</span>}
                            </div>

                            {currentRole === "Host" && !isMe && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => onUpdateRole(participant.userId, "Host")}
                                        className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs transition hover:bg-[var(--code-bg)]"
                                    >
                                        Make Host
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            onUpdateRole(
                                                participant.userId,
                                                isMod ? "Participant" : "Moderator"
                                            )
                                        }
                                        className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs transition hover:bg-[var(--code-bg)]"
                                    >
                                        {isMod ? "Dismiss Mod" : "Make Mod"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onRemoveParticipant(participant.userId)}
                                        className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-600 transition hover:bg-red-500/10"
                                    >
                                        Remove
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

function ConnectionBadge({ connected }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${connected
                ? "border-green-500/30 text-green-600 bg-green-500/10"
                : "border-red-500/30 text-red-600 bg-red-500/10"
                }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500 animate-pulse"
                    }`}
            />
            {connected ? "Connected" : "Reconnecting..."}
        </span>
    );
}

function LoadingState() {
    return (
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-[var(--border)]">
            <div className="text-center">
                <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50" />
                <p className="text-sm opacity-60">Joining room...</p>
            </div>
        </div>
    );
}