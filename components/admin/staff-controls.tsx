"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { inviteStaff, setUserActive, changeUserRole, resendStaffInvite } from "@/app/actions/staff";

// No invite email went out (email not set up yet, or refused), so the admin
// has to pass the one-time link on themselves — WhatsApp, SMS, in person.
async function copyInviteLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("No email sent — invite link copied. Send it to them yourself.", { duration: 8000 });
  } catch {
    window.prompt("No email sent — copy this invite link and send it to them yourself:", url);
  }
}

export function InviteStaffForm({ branches }: { branches: { id: string; name: string }[] }) {
  const [role, setRole] = useState("pos_user");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = Object.fromEntries(new FormData(form));
        setInviteUrl(null);
        start(async () => {
          const r = await inviteStaff({
            full_name: fd.full_name, email: fd.email, phone: fd.phone,
            role: fd.role, branch_id: fd.branch_id,
            vehicle_type: fd.vehicle_type || undefined,
            vehicle_number: fd.vehicle_number || undefined,
          });
          if (r?.error) return void toast.error(r.error);
          form.reset();
          if (r.inviteUrl) { setInviteUrl(r.inviteUrl); await copyInviteLink(r.inviteUrl); }
          else toast.success("Invite sent");
        });
      }}
    >
      <h3 className="font-display font-bold text-brand-brown">Invite staff</h3>
      <input name="full_name" required placeholder="Full name" className="input" maxLength={100} />
      <input name="email" required type="email" placeholder="Email" className="input" />
      <input name="phone" required placeholder="Phone (98XXXXXXXX)" className="input" maxLength={15} />
      <div className="grid grid-cols-2 gap-3">
        <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="pos_user">POS user</option>
          <option value="delivery_driver">Delivery driver</option>
          <option value="super_admin">Super admin</option>
        </select>
        <select name="branch_id" required className="input">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {role === "delivery_driver" && (
        <div className="grid grid-cols-2 gap-3">
          <select name="vehicle_type" className="input">
            <option value="bike">Bike</option><option value="scooter">Scooter</option><option value="cycle">Cycle</option>
          </select>
          <input name="vehicle_number" placeholder="Vehicle no." className="input" maxLength={20} />
        </div>
      )}
      <button disabled={pending} className="btn-primary">{pending ? "Sending…" : "Send invite"}</button>
      {inviteUrl && (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-bold">Account created, but no email was sent.</p>
          <p className="mt-1">Send this one-time link to them yourself (WhatsApp, SMS):</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={inviteUrl} className="input !py-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => copyInviteLink(inviteUrl)} className="shrink-0 font-bold text-brand-orange">Copy</button>
          </div>
        </div>
      )}
    </form>
  );
}

export function CustomerRowActions({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (isActive && !confirm("Suspend this account? Their sessions end immediately.")) return;
        start(async () => {
          const r = await setUserActive(userId, !isActive);
          r?.error ? toast.error(r.error) : toast.success(isActive ? "Suspended" : "Reactivated");
        });
      }}
      className={isActive ? "text-xs font-bold text-brand-red" : "text-xs font-bold text-brand-green"}
    >
      {isActive ? "Suspend" : "Reactivate"}
    </button>
  );
}

export function StaffRowActions({
  userId, isActive, role, branches, inviteAccepted,
}: { userId: string; isActive: boolean; role: string; branches: { id: string; name: string }[]; inviteAccepted: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={role}
        disabled={pending}
        className="input !w-auto !py-1 text-xs"
        onChange={(e) => {
          const newRole = e.target.value;
          const branchId = ["pos_user", "delivery_driver"].includes(newRole) ? branches[0]?.id : undefined;
          start(async () => {
            const r = await changeUserRole(userId, newRole, branchId);
            r?.error ? toast.error(r.error) : toast.success("Role updated");
          });
        }}
      >
        <option value="customer">customer</option>
        <option value="pos_user">pos_user</option>
        <option value="delivery_driver">delivery_driver</option>
        <option value="super_admin">super_admin</option>
      </select>
      {!inviteAccepted && isActive && (
        <button
          disabled={pending}
          onClick={() => {
            start(async () => {
              const r = await resendStaffInvite(userId);
              if (r?.error) toast.error(r.error);
              else if (r.inviteUrl) await copyInviteLink(r.inviteUrl);
              else toast.success("Invite resent");
            });
          }}
          className="text-xs font-bold text-brand-orange"
        >
          Resend invite
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => {
          if (isActive && !confirm("Suspend this account? Their sessions end immediately.")) return;
          start(async () => {
            const r = await setUserActive(userId, !isActive);
            r?.error ? toast.error(r.error) : toast.success(isActive ? "Suspended" : "Reactivated");
          });
        }}
        className={isActive ? "text-xs font-bold text-brand-red" : "text-xs font-bold text-brand-green"}
      >
        {isActive ? "Suspend" : "Reactivate"}
      </button>
    </div>
  );
}
