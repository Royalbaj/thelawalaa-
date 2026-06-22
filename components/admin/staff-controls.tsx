"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { inviteStaff, setUserActive, changeUserRole } from "@/app/actions/staff";

export function InviteStaffForm({ branches }: { branches: { id: string; name: string }[] }) {
  const [role, setRole] = useState("pos_user");
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = Object.fromEntries(new FormData(form));
        start(async () => {
          const r = await inviteStaff({
            full_name: fd.full_name, email: fd.email, phone: fd.phone,
            role: fd.role, branch_id: fd.branch_id,
            vehicle_type: fd.vehicle_type || undefined,
            vehicle_number: fd.vehicle_number || undefined,
          });
          if (r?.error) toast.error(r.error);
          else { toast.success("Invite sent"); form.reset(); }
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
          <option value="admin">Admin</option>
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

    </form>
  );
}

export function StaffRowActions({
  userId, isActive, role, branches,
}: { userId: string; isActive: boolean; role: string; branches: { id: string; name: string }[] }) {
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
        <option value="admin">admin</option>
      </select>
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
