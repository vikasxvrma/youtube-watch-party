const pool = require("../db/pool");

// Create a new user
async function createUser(name, email, passwordHash) {
  const result = await pool.query(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at
    `,
    [name, email, passwordHash]
  );

  return result.rows[0];
}

// Find a user by email
async function getUserByEmail(email) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        email,
        password_hash,
        created_at
      FROM users
      WHERE email = $1
    `,
    [email]
  );

  return result.rows[0] || null;
}

// Find a user by ID
async function getUserById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        email,
        created_at
      FROM users
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
};