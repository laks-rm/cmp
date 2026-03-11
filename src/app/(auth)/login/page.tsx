import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ManualLoginForm } from "@/components/auth/ManualLoginForm";
import { QuickLoginCards } from "@/components/auth/QuickLoginCards";
import { OktaLoginButton } from "@/components/auth/OktaLoginButton";

export default async function LoginPage() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    // Ignore JWT decryption errors from old cookies - they'll be cleared on new login
    console.log("Session check error (likely old cookie):", error);
  }
  
  if (session) {
    redirect("/");
  }

  const isCredentialsMode = process.env.AUTH_PROVIDER !== "okta";

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#FF444F] to-[#3B6CE7] text-lg font-bold text-white shadow-md">CM</div>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            CMP
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Compliance Monitoring Platform
          </p>
          <p className="mt-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Deriv Group
          </p>
        </div>

        <div className="rounded-[20px] border bg-white p-8 shadow-md" style={{ borderColor: "var(--border)" }}>
          {isCredentialsMode ? (
            <>
              <section className="mb-6">
                <div className="mb-4 rounded-lg border px-4 py-3 text-center text-sm font-medium" style={{ backgroundColor: "var(--amber-light)", borderColor: "var(--amber)", color: "var(--amber)" }}>
                  Development Mode — Click a role to login instantly
                </div>
                <QuickLoginCards />
              </section>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: "var(--border-light)" }} />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 font-medium" style={{ color: "var(--text-muted)" }}>
                    or sign in manually
                  </span>
                </div>
              </div>

              <section className="rounded-xl border p-5" style={{ borderColor: "var(--border-light)", backgroundColor: "var(--bg-subtle)" }}>
                <ManualLoginForm />
              </section>
            </>
          ) : (
            <section className="rounded-xl border p-6 text-center" style={{ borderColor: "var(--border-light)" }}>
              <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                Use your enterprise SSO account to continue.
              </p>
              <OktaLoginButton />
            </section>
          )}
        </div>

        <div className="text-center text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Deriv Group · Internal Use Only · v2.0
        </div>
      </div>
    </div>
  );
}
