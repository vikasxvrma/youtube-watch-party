const pool = require("../db/pool");

async function createRoom(roomId, user, videoId = null) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roomResult = await client.query(
      `
      INSERT INTO rooms (code, host_id, video_id)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [roomId, user.userId, videoId]
    );

    const room = roomResult.rows[0];

    await client.query(
      `
      INSERT INTO room_participants (room_id, user_id, role)
      VALUES ($1, $2, $3)
      `,
      [room.id, user.userId, "Host"]
    );

    await client.query("COMMIT");

    return room;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getRoom(roomId) {
  const result = await pool.query(
    `
    SELECT *
    FROM rooms
    WHERE code = $1
    `,
    [roomId]
  );

  return result.rows[0] || null;
}

async function deleteRoom(roomId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const room = await getRoom(roomId);

    if (!room) {
      await client.query("ROLLBACK");
      return null;
    }

    // 1. Delete associated participants first (for non-cascading FK constraints)
    await client.query(
      `
      DELETE FROM room_participants
      WHERE room_id = $1
      `,
      [room.id]
    );

    // 2. Delete the room itself
    const result = await client.query(
      `
      DELETE FROM rooms
      WHERE id = $1
      RETURNING *
      `,
      [room.id]
    );

    await client.query("COMMIT");
    return result.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addParticipant(roomId, userId) {
  const room = await getRoom(roomId);

  if (!room) {
    return null;
  }

  await pool.query(
    `
    INSERT INTO room_participants (room_id, user_id, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (room_id, user_id)
    DO NOTHING
    `,
    [room.id, userId, "Participant"]
  );

  return room;
}

async function removeParticipant(roomId, userId) {
  const room = await getRoom(roomId);

  if (!room) {
    return null;
  }

  await pool.query(
    `
    DELETE FROM room_participants
    WHERE room_id = $1 AND user_id = $2
    `,
    [room.id, userId]
  );

  return room;
}

async function getParticipants(roomId, activeUserIds = new Set()) {
  const room = await getRoom(roomId);

  if (!room) {
    return [];
  }

  const result = await pool.query(
    `
    SELECT
      u.id AS "userId",
      u.name AS username,
      rp.role
    FROM room_participants rp
    JOIN users u
      ON u.id = rp.user_id
    WHERE rp.room_id = $1
    ORDER BY rp.joined_at ASC
    `,
    [room.id]
  );

  return result.rows.map((row) => ({
    ...row,
    isOnline: activeUserIds.has(Number(row.userId)),
  }));
}

async function updateRoomPlayback(roomId, playState, currentTime) {
  const result = await pool.query(
    `
    UPDATE rooms
    SET
      play_state = $2,
      current_time_position = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE code = $1
    RETURNING *
    `,
    [roomId, playState, currentTime]
  );

  return result.rows[0] || null;
}

async function updateRoomVideo(roomId, videoId) {
  const result = await pool.query(
    `
    UPDATE rooms
    SET
      video_id = $2,
      play_state = 'paused',
      current_time_position = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE code = $1
    RETURNING *
    `,
    [roomId, videoId]
  );

  return result.rows[0] || null;
}

async function updateParticipantRole(roomId, targetUserId, newRole, currentHostId = null) {
  const room = await getRoom(roomId);

  if (!room) {
    return null;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // If transferring Host role, demote current host to Participant and update room host_id
    if (newRole === "Host" && currentHostId) {
      await client.query(
        `
        UPDATE room_participants
        SET role = 'Participant'
        WHERE room_id = $1 AND user_id = $2
        `,
        [room.id, currentHostId]
      );

      await client.query(
        `
        UPDATE rooms
        SET host_id = $2
        WHERE id = $1
        `,
        [room.id, targetUserId]
      );
    }

    const result = await client.query(
      `
      UPDATE room_participants
      SET role = $3
      WHERE room_id = $1
        AND user_id = $2
      RETURNING *
      `,
      [room.id, targetUserId, newRole]
    );

    await client.query("COMMIT");
    return result.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createRoom,
  getRoom,
  deleteRoom,
  addParticipant,
  removeParticipant,
  getParticipants,
  updateRoomPlayback,
  updateRoomVideo,
  updateParticipantRole,
};