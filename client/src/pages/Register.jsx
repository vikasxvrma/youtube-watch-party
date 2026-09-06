import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
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

    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();

    if (!trimmedName || !trimmedEmail || !form.password) {
      toast.error("Name, email, and password are required.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
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
          data.message || "Registration failed. Please try again."
        );
      }

      toast.success("Account created successfully!");
      
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 800);
    } catch (err) {
      toast.error(
        err.message || "Unable to create your account. Please try again later."
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
          <h1 className="!mb-2 !text-3xl !font-bold">
            Create your account
          </h1>

          <p className="mb-7 text-sm opacity-60">
            Start hosting synchronized YouTube watch parties.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Field
              label="Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Vikas"
              autoComplete="name"
              autoFocus
              required
            />

            <Field
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <Field
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />

            <Field
              label="Confirm password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />

            <button
              type="submit"
              disabled={loading}
             className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-medium text-[#14121F] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm opacity-60">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-[var(--text-h)] underline"
            >
              Sign in
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
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
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
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required={required}
        className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 outline-none transition focus:border-[var(--text-h)]"
      />
    </div>
  );
}