const {
  createRoom,
  getRoom,
  deleteRoom, // <-- IMPORTED HERE
  addParticipant,
  removeParticipant,
  getParticipants,
  updateRoomPlayback,
  updateRoomVideo,
  updateParticipantRole,
} = require("../services/roomService");

const { getUserById } = require("../services/userService");

function registerRoomHandlers(io, socket) {
  // Helper to retrieve currently connected user IDs in a room
  const getActiveUserIds = (roomId) => {
    const activeUserIds = new Set();
    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);

    if (socketsInRoom) {
      for (const socketId of socketsInRoom) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket?.data?.userId) {
          activeUserIds.add(Number(clientSocket.data.userId));
        }
      }
    }
    return activeUserIds;
  };

  // Helper to get participants with online status attached
  const fetchParticipants = async (roomId) => {
    const activeUserIds = getActiveUserIds(roomId);
    return await getParticipants(roomId, activeUserIds);
  };

  // =========================================================
  // CREATE ROOM
  // =========================================================

  socket.on("create_room", async ({ roomId }) => {
    try {
      const userId = socket.data.userId;

      if (!roomId || typeof roomId !== "string") {
        socket.emit("error_message", { message: "Invalid room ID" });
        return;
      }

      const user = await getUserById(userId);

      if (!user) {
        socket.emit("error_message", { message: "User not found" });
        return;
      }

      const existingRoom = await getRoom(roomId);

      if (existingRoom) {
        socket.emit("error_message", { message: "Room already exists" });
        return;
      }

      const room = await createRoom(roomId, {
        userId: user.id,
        username: user.name,
      });

      socket.data.roomId = roomId;
      socket.join(roomId);

      const participants = await fetchParticipants(roomId);

      socket.emit("room_created", {
        roomId,
        userId: user.id,
        role: "Host",
        playState: room.play_state,
        currentTime: Number(room.current_time_position) || 0,
        videoId: room.video_id || null,
        participants,
      });

      console.log(`${user.name} created room ${roomId}`);
    } catch (error) {
      console.error("Create room error:", error);
      socket.emit("error_message", { message: "Failed to create room" });
    }
  });

  // =========================================================
  // JOIN ROOM
  // =========================================================

  socket.on("join_room", async ({ roomId }) => {
    try {
      const userId = socket.data.userId;

      if (!roomId || typeof roomId !== "string") {
        socket.emit("error_message", { message: "Invalid room ID" });
        return;
      }

      const user = await getUserById(userId);

      if (!user) {
        socket.emit("error_message", { message: "User not found" });
        return;
      }

      const room = await getRoom(roomId);

      if (!room) {
        socket.emit("error_message", { message: "Room does not exist" });
        return;
      }

      await addParticipant(roomId, user.id);

      socket.data.roomId = roomId;
      socket.join(roomId);

      const participants = await fetchParticipants(roomId);

      const currentParticipant = participants.find(
        (p) => Number(p.userId) === Number(user.id)
      );

      socket.to(roomId).emit("user_joined", {
        username: user.name,
        userId: user.id,
        role: currentParticipant?.role || "Participant",
        participants,
      });

      let currentTime = Number(room.current_time_position) || 0;

      if (room.play_state === "playing") {
        const updatedAt = new Date(room.updated_at).getTime();
        currentTime += (Date.now() - updatedAt) / 1000;
      }

      socket.emit("sync_state", {
        userId: user.id,
        role: currentParticipant?.role || "Participant",
        playState: room.play_state,
        currentTime,
        videoId: room.video_id || null,
        participants,
      });

      console.log(`${user.name} joined room ${roomId}`);
    } catch (error) {
      console.error("Join room error:", error);
      socket.emit("error_message", { message: "Failed to join room" });
    }
  });

  // =========================================================
  // DELETE ROOM
  // =========================================================

  socket.on("delete_room", async () => {
    try {
      const roomId = socket.data.roomId;
      const requesterId = socket.data.userId;

      if (!roomId) {
        socket.emit("error_message", { message: "You are not inside a room" });
        return;
      }

      const room = await getRoom(roomId);

      if (!room) {
        socket.emit("error_message", { message: "Room does not exist" });
        return;
      }

      const participants = await fetchParticipants(roomId);
      const requester = participants.find(
        (p) => Number(p.userId) === Number(requesterId)
      );

      if (!requester || requester.role !== "Host") {
        socket.emit("error_message", {
          message: "Only the Host can delete this room",
        });
        return;
      }

      // Delete room from DB/service layer
      await deleteRoom(roomId);

      // Notify all connected users in the room
      io.to(roomId).emit("room_deleted", {
        roomId,
        message: "The host has deleted this room",
      });

      // Clear socket tracking state & leave the channel for all room members
      const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
      if (socketsInRoom) {
        for (const socketId of socketsInRoom) {
          const clientSocket = io.sockets.sockets.get(socketId);
          if (clientSocket) {
            clientSocket.data.roomId = null;
          }
        }
      }

      io.in(roomId).socketsLeave(roomId);

      console.log(`Room ${roomId} deleted by host (User ID: ${requesterId})`);
    } catch (error) {
      console.error("Delete room error:", error);
      socket.emit("error_message", { message: "Failed to delete room" });
    }
  });

  // =========================================================
  // PLAY
  // =========================================================

  socket.on("play", async (data = {}) => {
    try {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (!roomId) {
        socket.emit("error_message", { message: "You are not inside a room" });
        return;
      }

      const room = await getRoom(roomId);

      if (!room) {
        socket.emit("error_message", { message: "Room does not exist" });
        return;
      }

      const participants = await fetchParticipants(roomId);
      const participant = participants.find(
        (p) => Number(p.userId) === Number(userId)
      );

      if (!participant) {
        socket.emit("error_message", {
          message: "You are not a participant in this room",
        });
        return;
      }

      if (participant.role !== "Host" && participant.role !== "Moderator") {
        socket.emit("error_message", {
          message: "You do not have permission to control playback",
        });
        return;
      }

      let currentTime;
      if (
        typeof data.currentTime === "number" &&
        Number.isFinite(data.currentTime) &&
        data.currentTime >= 0
      ) {
        currentTime = data.currentTime;
      } else {
        currentTime = Number(room.current_time_position) || 0;
      }

      await updateRoomPlayback(roomId, "playing", currentTime);

      io.to(roomId).emit("play", { currentTime });
    } catch (error) {
      console.error("Play error:", error);
      socket.emit("error_message", { message: "Failed to play video" });
    }
  });

  // =========================================================
  // PAUSE
  // =========================================================

  socket.on("pause", async (data = {}) => {
    try {
      const { time } = data;
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (!roomId) {
        socket.emit("error_message", { message: "You are not inside a room" });
        return;
      }

      const room = await getRoom(roomId);

      if (!room) {
        socket.emit("error_message", { message: "Room does not exist" });
        return;
      }

      const participants = await fetchParticipants(roomId);
      const participant = participants.find(
        (p) => Number(p.userId) === Number(userId)
      );

      if (!participant) {
        socket.emit("error_message", {
          message: "You are not a participant in this room",
        });
        return;
      }

      if (participant.role !== "Host" && participant.role !== "Moderator") {
        socket.emit("error_message", {
          message: "You do not have permission to control playback",
        });
        return;
      }

      if (typeof time !== "number" || !Number.isFinite(time) || time < 0) {
        socket.emit("error_message", { message: "Invalid pause time" });
        return;
      }

      await updateRoomPlayback(roomId, "paused", time);

      io.to(roomId).emit("pause", { time });
    } catch (error) {
      console.error("Pause error:", error);
      socket.emit("error_message", { message: "Failed to pause video" });
    }
  });

  // =========================================================
  // SEEK
  // =========================================================

  socket.on("seek", async (data = {}) => {
    try {
      const { time } = data;
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (!roomId) {
        socket.emit("error_message", { message: "You are not inside a room" });
        return;
      }

      const room = await getRoom(roomId);

      if (!room) {
        socket.emit("error_message", { message: "Room does not exist" });
        return;
      }

      const participants = await fetchParticipants(roomId);
      const participant = participants.find(
        (p) => Number(p.userId) === Number(userId)
      );

      if (!participant) {
        socket.emit("error_message", {
          message: "You are not a participant in this room",
        });
        return;
      }

      if (participant.role !== "Host" && participant.role !== "Moderator") {
        socket.emit("error_message", {
          message: "You do not have permission to control playback",
        });
        return;
      }

      if (typeof time !== "number" || !Number.isFinite(time) || time < 0) {
        socket.emit("error_message", { message: "Invalid seek time" });
        return;
      }

      await updateRoomPlayback(roomId, room.play_state, time);

      io.to(roomId).emit("seek", { time });
    } catch (error) {
      console.error("Seek error:", error);
      socket.emit("error_message", { message: "Failed to seek video" });
    }
  });

  // =========================================================
  // CHANGE VIDEO
  // =========================================================

  socket.on("change_video", async (data = {}) => {
    try {
      const { videoId } = data;
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (!roomId) {
        socket.emit("error_message", { message: "You are not inside a room" });
        return;
      }

      const room = await getRoom(roomId);

      if (!room) {
        socket.emit("error_message", { message: "Room does not exist" });
        return;
      }

      const participants = await fetchParticipants(roomId);
      const participant = participants.find(
        (p) => Number(p.userId) === Number(userId)
      );

      if (!participant) {
        socket.emit("error_message", {
          message: "You are not a participant in this room",
        });
        return;
      }

      if (participant.role !== "Host" && participant.role !== "Moderator") {
        socket.emit("error_message", {
          message: "You do not have permission to change the video",
        });
        return;
      }

      if (typeof videoId !== "string" || !videoId.trim()) {
        socket.emit("error_message", { message: "Invalid video ID" });
        return;
      }

      const cleanedVideoId = videoId.trim();

      await updateRoomVideo(roomId, cleanedVideoId);

      io.to(roomId).emit("change_video", { videoId: cleanedVideoId });
    } catch (error) {
      console.error("Change video error:", error);
      socket.emit("error_message", { message: "Failed to change video" });
    }
  });

  // =========================================================
  // ASSIGN ROLE (Includes Host transfer support)
  // =========================================================

  socket.on("assign_role", async (data = {}) => {
    try {
      const { userId, role } = data;
      const roomId = socket.data.roomId;
      const requesterId = socket.data.userId;

      if (!roomId) {
        socket.emit("error_message", { message: "You are not inside a room" });
        return;
      }

      const room = await getRoom(roomId);

      if (!room) {
        socket.emit("error_message", { message: "Room does not exist" });
        return;
      }

      const participants = await fetchParticipants(roomId);
      const requester = participants.find(
        (p) => Number(p.userId) === Number(requesterId)
      );

      if (!requester || requester.role !== "Host") {
        socket.emit("error_message", {
          message: "Only the Host can assign roles",
        });
        return;
      }

      const participant = participants.find(
        (p) => Number(p.userId) === Number(userId)
      );

      if (!participant) {
        socket.emit("error_message", { message: "Participant not found" });
        return;
      }

      if (role !== "Host" && role !== "Moderator" && role !== "Participant") {
        socket.emit("error_message", { message: "Invalid role" });
        return;
      }

      await updateParticipantRole(roomId, userId, role, requesterId);

      const updatedParticipants = await fetchParticipants(roomId);

      io.to(roomId).emit("role_assigned", {
        userId,
        role,
        participants: updatedParticipants,
      });
    } catch (error) {
      console.error("Assign role error:", error);
      socket.emit("error_message", { message: "Failed to assign role" });
    }
  });

  // =========================================================
  // REMOVE PARTICIPANT
  // =========================================================

  socket.on("remove_participant", async (data = {}) => {
    try {
      const { userId } = data;
      const roomId = socket.data.roomId;
      const requesterId = socket.data.userId;

      if (!roomId) {
        socket.emit("error_message", { message: "You are not inside a room" });
        return;
      }

      const room = await getRoom(roomId);

      if (!room) {
        socket.emit("error_message", { message: "Room does not exist" });
        return;
      }

      const participants = await fetchParticipants(roomId);
      const requester = participants.find(
        (p) => Number(p.userId) === Number(requesterId)
      );

      if (!requester || requester.role !== "Host") {
        socket.emit("error_message", {
          message: "Only the Host can remove participants",
        });
        return;
      }

      if (Number(userId) === Number(requesterId)) {
        socket.emit("error_message", {
          message: "Host cannot remove themselves",
        });
        return;
      }

      const participant = participants.find(
        (p) => Number(p.userId) === Number(userId)
      );

      if (!participant) {
        socket.emit("error_message", { message: "Participant not found" });
        return;
      }

      await removeParticipant(roomId, userId);

      const updatedParticipants = await fetchParticipants(roomId);

      io.to(roomId).emit("participant_removed", {
        userId,
        participants: updatedParticipants,
      });

      for (const [socketId, connectedSocket] of io.sockets.sockets) {
        if (
          Number(connectedSocket.data.userId) === Number(userId) &&
          connectedSocket.data.roomId === roomId
        ) {
          connectedSocket.emit("removed_from_room", {
            message: "You have been removed from the room",
          });
          connectedSocket.leave(roomId);
          connectedSocket.data.roomId = null;
          break;
        }
      }
    } catch (error) {
      console.error("Remove participant error:", error);
      socket.emit("error_message", {
        message: "Failed to remove participant",
      });
    }
  });

  // =========================================================
  // LEAVE ROOM (Voluntary)
  // =========================================================

  socket.on("leave_room", async () => {
    try {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (!roomId) return;

      const user = await getUserById(userId);

      socket.leave(roomId);
      socket.data.roomId = null;

      socket.emit("left_room");

      const participants = await fetchParticipants(roomId);

      socket.to(roomId).emit("user_left", {
        userId,
        username: user ? user.name : "A user",
        participants,
      });

      console.log(`User ${userId} left socket room ${roomId}`);
    } catch (error) {
      console.error("Leave room error:", error);
    }
  });

  // =========================================================
  // DISCONNECT (Browser tab closed or network drop)
  // =========================================================

  socket.on("disconnect", async () => {
    try {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (!roomId) return;

      const user = await getUserById(userId);

      const participants = await fetchParticipants(roomId);

      socket.to(roomId).emit("user_left", {
        userId,
        username: user ? user.name : "A user",
        participants,
      });

      console.log(`User ${userId} disconnected from room ${roomId}`);
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  });
}

module.exports = registerRoomHandlers;