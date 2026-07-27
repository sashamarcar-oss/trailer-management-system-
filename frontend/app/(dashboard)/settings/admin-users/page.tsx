"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, Pencil, Plus, ShieldCheck, UserX, X } from "lucide-react";
import { axiosClient } from "@/lib/api";
import { ModuleHeader } from "@/components/ui/ModuleHeader";

type AdminUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  deactivated: boolean;
  role_name: string;
  created_at: string;
};

type AdminForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
};

const emptyForm: AdminForm = { first_name: "", last_name: "", email: "", phone: "", password: "", confirm_password: "" };

function displayName(admin: AdminUser) {
  return `${admin.first_name} ${admin.last_name}`.trim() || admin.email;
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<AdminForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosClient.get<AdminUser[]>("/users/admin-users/");
      setAdmins(data);
    } catch {
      setError("Unable to load administrator accounts. Confirm that your account has administrator access and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setOpen(true);
  }

  function openEdit(admin: AdminUser) {
    setEditing(admin);
    setForm({ first_name: admin.first_name, last_name: admin.last_name, email: admin.email, phone: admin.phone || "", password: "", confirm_password: "" });
    setFormError("");
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!editing && (!form.password || !form.confirm_password)) {
      setFormError("Password and confirmation are required for a new administrator.");
      return;
    }
    if (form.password && form.password !== form.confirm_password) {
      setFormError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) {
        delete (payload as Partial<AdminForm>).password;
        delete (payload as Partial<AdminForm>).confirm_password;
      }
      if (editing) await axiosClient.patch(`/users/${editing.id}/admin-user/`, payload);
      else await axiosClient.post("/users/admin-users/", payload);
      setOpen(false);
      await load();
    } catch (requestError: any) {
      const data = requestError?.response?.data;
      const message = typeof data === "object" && data ? Object.values(data).flat().join(" ") : "Unable to save this administrator.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleDeactivated(admin: AdminUser) {
    const nextState = !admin.deactivated;
    const verb = nextState ? "deactivate" : "reactivate";
    if (!window.confirm(`${verb[0].toUpperCase()}${verb.slice(1)} ${displayName(admin)}?`)) return;
    try {
      await axiosClient.patch(`/users/${admin.id}/admin-user/`, { deactivated: nextState });
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || "Unable to update this administrator account.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModuleHeader title="Admin users" subtitle="Settings / Admin users · Every account below has the shared TrailerOps administrator dashboard." />
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
          <Plus size={17} /> Add admin
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-teal-light/30 px-5 py-4 text-sm text-muted-foreground">
          <ShieldCheck className="shrink-0 text-teal" size={20} />
          New administrators can sign in immediately and have the same dashboard access as every other administrator.
        </div>
        {error && <div className="m-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={17} /> {error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Email</th><th className="px-5 py-3 font-semibold">Phone</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">Loading administrators…</td></tr> : admins.length ? admins.map((admin) => (
                <tr key={admin.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-4 font-medium">{displayName(admin)}</td>
                  <td className="px-5 py-4 text-muted-foreground">{admin.email}</td>
                  <td className="px-5 py-4 text-muted-foreground">{admin.phone || "—"}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${admin.is_active && !admin.deactivated ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{admin.is_active && !admin.deactivated ? "Active" : "Deactivated"}</span></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEdit(admin)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-teal hover:bg-teal-light/30"><Pencil size={15} /> Edit</button><button onClick={() => toggleDeactivated(admin)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-red-600 hover:bg-red-50"><UserX size={15} /> {admin.deactivated ? "Reactivate" : "Deactivate"}</button></div></td>
                </tr>
              )) : <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No administrator accounts found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl"><div className="flex items-center justify-between border-b border-border px-6 py-4"><div><h2 className="text-lg font-semibold">{editing ? "Edit administrator" : "Add administrator"}</h2><p className="mt-0.5 text-xs text-muted-foreground">All administrators receive the same TrailerOps dashboard access.</p></div><button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={20} /></button></div><form onSubmit={save} className="space-y-4 px-6 py-5">{formError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}<div className="grid grid-cols-2 gap-4"><label className="text-sm font-medium">First name<input required value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2" /></label><label className="text-sm font-medium">Last name<input required value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2" /></label></div><label className="block text-sm font-medium">Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2" /></label><label className="block text-sm font-medium">Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2" /></label><div className="grid grid-cols-2 gap-4"><label className="text-sm font-medium">{editing ? "New password (optional)" : "Password"}<input required={!editing} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2" /></label><label className="text-sm font-medium">Confirm password<input required={!editing || Boolean(form.password)} type="password" value={form.confirm_password} onChange={(event) => setForm({ ...form, confirm_password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2" /></label></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-input px-4 py-2 text-sm font-medium">Cancel</button><button disabled={saving} type="submit" className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving…" : editing ? "Save changes" : "Create admin"}</button></div></form></div></div>}
    </div>
  );
}
