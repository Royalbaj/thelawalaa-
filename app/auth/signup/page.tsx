import AuthShell from "@/components/auth/auth-shell";
import SignupForm from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Order ahead, track your food live, and earn points on every order.">
      <SignupForm />
    </AuthShell>
  );
}
