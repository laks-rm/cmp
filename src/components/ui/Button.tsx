"use client";

import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500",
    secondary: "bg-slate-800 text-white hover:bg-slate-700",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  };
  return <button className={`${base} ${variants[variant]} ${className}`.trim()} {...props} />;
}
