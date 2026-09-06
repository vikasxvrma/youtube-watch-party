import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { saveAuth } from "../services/auth";
import { connectSocket } from "../services/socket";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedEmail = form.email.trim();

    if (!trimmedEmail || !form.password) {
      toast.error("Please enter both email and password.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: form.password,
        }),
      });

      const contentType = response.headers.get("content-type");
      let data = {};

      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Login failed. Please check your credentials."
        );
      }

      saveAuth(data.token, data.user);
      connectSocket();

      toast.success("Signed in successfully!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(
        err.message || "Unable to connect to server. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 inline-block text-sm opacity-60 hover:opacity-100"
        >
          ← Back to home
        </Link>

        <div className="rounded-2xl border border-[var(--border)] p-7 shadow-sm">
          <h1 className="!mb-2 !text-3xl !font-bold">Welcome back</h1>

          <p className="mb-7 text-sm opacity-60">
            Sign in to continue to your watch parties.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Field
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoFocus
              required
            />

            <Field
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--text-h)] px-4 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm opacity-60">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-[var(--text-h)] underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type,
  value,
  onChange,
  placeholder,
  autoFocus = false,
  required = false,
}) {
  return (
    <div className="text-left">
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium text-[var(--text-h)]"
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        autoComplete={name === "password" ? "current-password" : "email"}
        className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 outline-none transition focus:border-[var(--text-h)]"
      />
    </div>
  );
}