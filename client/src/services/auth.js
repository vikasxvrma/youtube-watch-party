const TOKEN_KEY = "token";
const USER_KEY = "user";
const ROOM_KEY = "watch_party_room";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const value = localStorage.getItem(USER_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROOM_KEY);
}

export function getSavedRoom() {
  return localStorage.getItem(ROOM_KEY);
}

export function saveRoom(roomId) {
  if (roomId) {
    localStorage.setItem(ROOM_KEY, roomId);
  }
}

export function clearSavedRoom() {
  localStorage.removeItem(ROOM_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}