import { ChevronLeft, Envelope } from "@gravity-ui/icons";
import {
  Button,
  FieldError,
  Input,
  InputOTP,
  Label,
  Link,
  REGEXP_ONLY_DIGITS,
  TextField,
} from "@heroui/react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import loginImage from "#/assets/login.jpeg";
import { authClient } from "#/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

type Step = "initial" | "email-input" | "otp-input";

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("initial");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startResendTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
    setLoading(false);
  }

  async function handleSendCode() {
    if (!email) return;
    setLoading(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Failed to send code.");
      return;
    }
    setStep("otp-input");
    startResendTimer();
  }

  async function handleResend() {
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    if (err) {
      setError(err.message ?? "Failed to resend code.");
      return;
    }
    startResendTimer();
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) return;
    setLoading(true);
    setError(null);
    const { error: err } = await authClient.signIn.emailOtp({
      email,
      otp,
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Invalid code. Please try again.");
      return;
    }
    navigate({ to: "/dashboard" });
  }

  function goBack() {
    setError(null);
    setOtp("");
    if (timerRef.current) clearInterval(timerRef.current);
    setResendTimer(0);
    setStep(step === "otp-input" ? "email-input" : "initial");
  }

  return (
    <div className="flex h-screen w-full">
      <div className="flex w-full max-w-xl flex-col px-14 py-10">
        <div className="mb-16">
          <span className="text-foreground text-2xl font-semibold">azali</span>
        </div>

        <div className="flex w-full flex-col pt-40">
          {step === "initial" && (
            <>
              <h1 className="text-foreground mb-2 text-3xl font-semibold">
                Sign in
              </h1>
              <p className="text-muted mb-8 text-sm">
                Welcome back. Sign in to your account.
              </p>

              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  fullWidth
                  isPending={loading}
                  onPress={handleGoogleSignIn}
                >
                  <GoogleIcon />
                  Sign in with Google
                </Button>

                <div className="my-1 flex items-center gap-3">
                  <div className="bg-separator h-px flex-1" />
                  <span className="text-muted text-xs">or</span>
                  <div className="bg-separator h-px flex-1" />
                </div>

                <Button
                  variant="primary"
                  fullWidth
                  onPress={() => setStep("email-input")}
                >
                  <Envelope className="size-4" />
                  Sign in with Email
                </Button>
              </div>
            </>
          )}

          {step === "email-input" && (
            <>
              <Button
                variant="ghost"
                onPress={goBack}
                className="text-muted -ml-2 mb-8 w-fit"
              >
                <ChevronLeft className="size-4" />
                Back
              </Button>

              <h1 className="text-foreground mb-2 text-3xl font-semibold">
                Enter your email
              </h1>
              <p className="text-muted mb-8 text-sm">
                We'll send a sign-in code to your email address.
              </p>

              <div className="flex flex-col gap-3">
                <TextField
                  fullWidth
                  type="email"
                  isRequired
                  isInvalid={!!error}
                  value={email}
                  onChange={setEmail}
                  autoFocus
                >
                  <Label className="sr-only">Email address</Label>
                  <Input placeholder="you@example.com" />
                  {error && <FieldError>{error}</FieldError>}
                </TextField>

                <Button
                  variant="primary"
                  fullWidth
                  isPending={loading}
                  isDisabled={!email}
                  onPress={handleSendCode}
                >
                  Send code
                </Button>
              </div>
            </>
          )}

          {step === "otp-input" && (
            <>
              <Button
                variant="ghost"
                onPress={goBack}
                className="text-muted -ml-2 mb-8 w-fit"
              >
                <ChevronLeft className="size-4" />
                Back
              </Button>

              <div className="mb-6 flex flex-col gap-1">
                <h1 className="text-foreground text-3xl font-semibold">
                  Check your email
                </h1>
                <p className="text-muted text-sm">
                  We've sent a code to{" "}
                  <span className="text-foreground font-medium">{email}</span>.
                </p>
              </div>

              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                onComplete={handleVerifyOtp}
                pattern={REGEXP_ONLY_DIGITS}
                isInvalid={!!error}
                autoFocus
              >
                <InputOTP.Group>
                  <InputOTP.Slot index={0} />
                  <InputOTP.Slot index={1} />
                  <InputOTP.Slot index={2} />
                </InputOTP.Group>
                <InputOTP.Separator />
                <InputOTP.Group>
                  <InputOTP.Slot index={3} />
                  <InputOTP.Slot index={4} />
                  <InputOTP.Slot index={5} />
                </InputOTP.Group>
              </InputOTP>

              <div className="flex items-center gap-[5px] px-1 pt-3">
                <p className="text-muted text-sm">
                  {resendTimer > 0 ? (
                    <>Resend code in {resendTimer}s</>
                  ) : (
                    <>
                      Didn't receive a code?{" "}
                      <Link
                        className="text-foreground cursor-pointer text-sm underline"
                        onPress={handleResend}
                      >
                        Resend
                      </Link>
                    </>
                  )}
                </p>
              </div>

              {error && (
                <p className="text-danger px-1 pt-1 text-xs">{error}</p>
              )}

              <Button
                variant="primary"
                fullWidth
                isPending={loading}
                isDisabled={otp.length < 6}
                onPress={handleVerifyOtp}
                className="mt-4"
              >
                Verify code
              </Button>
            </>
          )}
        </div>

        <p className="text-muted mt-auto text-xs">
          By signing in, you agree to our{" "}
          <a
            href="#"
            className="hover:text-foreground underline transition-colors"
          >
            Terms
          </a>{" "}
          &amp;{" "}
          <a
            href="#"
            className="hover:text-foreground underline transition-colors"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>

      <div className="relative hidden flex-1 overflow-hidden lg:block">
        <img
          src={loginImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
