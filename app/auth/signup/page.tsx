import AuthShell from "@/components/auth/auth-shell";
import SignupForm from "@/components/auth/signup-form";
import SignedInNotice from "@/components/auth/signed-in-notice";

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Order ahead, track your food live, and earn points on every order.">
      <SignedInNotice purpose="signup" />
      <SignupForm />
    </AuthShell>
  );
}
