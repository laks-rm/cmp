"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";

export function OktaLoginButton() {
  return (
    <Button
      className="w-full"
      onClick={() =>
        signIn("okta", {
          callbackUrl: "/",
        })
      }
    >
      Sign in with Okta
    </Button>
  );
}
