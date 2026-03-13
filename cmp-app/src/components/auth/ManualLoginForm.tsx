"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import toast from "@/lib/toast";

export function ManualLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });

    setLoading(false);
    if (result?.error) {
      toast.error("Invalid credentials");
      return;
    }
    toast.success("Signed in");
    window.location.href = "/";
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          placeholder="your.email@deriv.com"
          required
          maxLength={255}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          placeholder="••••••••"
          required
          minLength={8}
          maxLength={128}
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: "var(--blue)" }}
        disabled={loading}
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
