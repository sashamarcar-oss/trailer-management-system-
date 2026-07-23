"use client";

import { useEffect, useState } from "react";
import { ModuleHeader } from "@/components/ui/ModuleHeader";
import { Table, Column } from "@/components/ui/Table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { AuditLog } from "@/types";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  LOGIN: "Login",
  LOGOUT: "Logout",
  VIEW: "View",
};

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auditLogs
      .list()
      .then((res) => setRows(res.results))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<AuditLog>[] = [
    { key: "created_at", label: "Timestamp", render: (r) => new Date(r.created_at).toLocaleString() },
    { key: "user_email", label: "Actor", render: (r) => r.user_email || "System" },
    { key: "model_name", label: "Module", render: (r) => r.model_name || "-" },
    { key: "action", label: "Action", render: (r) => <Badge status={ACTION_LABELS[r.action] || r.action} /> },
    { key: "object_id", label: "Entity", render: (r) => r.object_id || "-" },
    { key: "method", label: "Method", render: (r) => r.method || "-" },
    { key: "path", label: "Reference", render: (r) => r.path || "-" },
  ];

  return (
    <div>
      <ModuleHeader title="Audit logs" subtitle={`${rows.length} activity events captured`} />
      <Table columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
