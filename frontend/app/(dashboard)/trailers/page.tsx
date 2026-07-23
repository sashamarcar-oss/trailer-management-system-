"use client";

import { useEffect, useState } from "react";
import { ModuleHeader } from "@/components/ui/ModuleHeader";
import { Table, Column } from "@/components/ui/Table";
import { Badge } from "@/components/ui/badge";
import { TrailerForm } from "@/components/modules/trailers/trailer-form";
import { api } from "@/lib/api";
import { Trailer, Paginated } from "@/types";

export default function TrailersPage() {
  const [rows, setRows] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setLoading(true);
    api.trailers
      .list()
      .then((res: Paginated<Trailer>) => setRows(res.results))
      .finally(() => setLoading(false));
  }

  const columns: Column<Trailer>[] = [
    { key: "trailerNumber", label: "Trailer #" },
    { key: "type", label: "Type" },
    { key: "registrationNumber", label: "Registration" },
    { key: "location", label: "Location" },
    { key: "nextInspection", label: "Next inspection" },
    { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <ModuleHeader
        title="Trailer management"
        subtitle={`${rows.length} trailers loaded`}
        actionLabel="Add trailer"
        onAction={() => setFormOpen(true)}
      />
      <Table columns={columns} rows={rows} loading={loading} getRowKey={(r) => r.id} />

      <TrailerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(trailer) => setRows((prev) => [trailer, ...prev])}
      />
    </div>
  );
}
