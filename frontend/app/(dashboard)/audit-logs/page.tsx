"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  Eye,
  Activity,
  CalendarDays,
  Clock,
  Download,
} from "lucide-react";
import { ModuleHeader } from "@/components/ui/ModuleHeader";
import { Table, Column } from "@/components/ui/Table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE: <Plus className="h-4 w-4" />,
  UPDATE: <Pencil className="h-4 w-4" />,
  DELETE: <Trash2 className="h-4 w-4" />,
  LOGIN: <LogIn className="h-4 w-4" />,
  LOGOUT: <LogOut className="h-4 w-4" />,
  VIEW: <Eye className="h-4 w-4" />,
};

const ITEMS_PER_PAGE = 10;

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    api.auditLogs
      .list()
      .then((res) => setRows(res.results))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.user_email, r.model_name, r.action, r.object_id, r.method, r.path]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [rows, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getActionIcon = (action: string) =>
    ACTION_ICONS[action] || <Activity className="h-4 w-4" />;

  function exportCsv() {
    const fields = ["created_at", "user_email", "model_name", "action", "object_id", "method", "path"] as const;
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [fields.join(","), ...filteredRows.map((row) => fields.map((field) => escape(row[field])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "audit-logs.csv"; link.click(); URL.revokeObjectURL(url);
  }

  const columns: Column<AuditLog>[] = [
    {
      key: "created_at",
      label: "Timestamp",
      render: (r) => {
        const d = new Date(r.created_at);
        return (
          <div className="flex items-center whitespace-nowrap">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            {d.toLocaleDateString()}
            <Clock className="ml-2 mr-1 h-3.5 w-3.5 text-muted-foreground" />
            {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        );
      },
    },
    {
      key: "user_email",
      label: "Actor",
      render: (r) => <div className="font-medium">{r.user_email || "System"}</div>,
    },
    {
      key: "model_name",
      label: "Module",
      render: (r) => r.model_name || "-",
    },
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <div className="flex items-center">
          {getActionIcon(r.action)}
          <span className="ml-2">
            <Badge status={ACTION_LABELS[r.action] || r.action} />
          </span>
        </div>
      ),
    },
    {
      key: "object_id",
      label: "Entity",
      render: (r) => (
        <span className="text-muted-foreground text-xs">{r.object_id || "-"}</span>
      ),
    },
    {
      key: "method",
      label: "Method",
      render: (r) => r.method || "-",
    },
    {
      key: "path",
      label: "Reference",
      render: (r) => (
        <span className="text-muted-foreground text-xs">{r.path || "-"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap"><ModuleHeader title="Audit logs" subtitle={`${filteredRows.length} activity events captured`} /><Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button></div>

      <Card>
        <CardHeader>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search logs..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table columns={columns} rows={paginatedRows} loading={loading} />

          {!loading && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-medium">
                  {filteredRows.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)}
                </span>{" "}
                of <span className="font-medium">{filteredRows.length}</span> logs
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
