"use client";

import { useState, useEffect } from "react";
import { fetchAdmin } from "@/lib/adminApi";
import { Card, Button, DataTable } from "@/components/admin/ui";
import { TONES } from "@/components/admin/ui/tones";

const ICON_SEARCH = "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z";

export default function SearchesPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAdmin(`/analytics/searches?page=${page}&per_page=25`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const columns = [
    {
      key: "date", label: "Tarih", width: "18%",
      render: (event) => {
        const date = new Date(event.created_at);
        const dateStr = date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const timeStr = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        return (
          <span className="text-sm text-gray-300">
            {dateStr} <span className="text-xs text-gray-600 ml-1">{timeStr}</span>
          </span>
        );
      },
    },
    {
      key: "query", label: "Arama",
      render: (event) => (
        <span className="text-sm font-medium" style={{ color: TONES.mint.fg }}>
          {event.data?.query || "—"}
        </span>
      ),
    },
    {
      key: "page", label: "Sayfa", width: "28%",
      render: (event) => <span className="text-xs text-gray-500 font-mono truncate block">{event.page || "—"}</span>,
    },
    {
      key: "ip", label: "IP", width: "14%",
      render: (event) => (
        <span className="text-xs text-gray-600 font-mono">
          {event.ip_address ? event.ip_address.replace(/^::ffff:/, "") : "—"}
        </span>
      ),
    },
  ];

  return (
    <Card
      title="Arama Geçmişi"
      subtitle="Kullanıcıların aradığı tüm profiller"
      icon={ICON_SEARCH}
      flush
      actions={
        data?.last_page > 1 ? (
          <span className="text-xs text-gray-500">
            Toplam {data.total} arama — Sayfa {data.current_page}/{data.last_page}
          </span>
        ) : null
      }
    >
      {loading ? (
        <div className="p-8 text-center">
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
            style={{ borderColor: TONES.azure.bar, borderTopColor: "transparent" }}
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={data?.data || []}
          rowKey={(event) => event.id}
          empty="Henüz arama verisi yok."
        />
      )}

      {data?.last_page > 1 && (
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-edge/50">
          <Button variant="neutral" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Önceki
          </Button>
          <Button variant="neutral" size="sm" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}>
            Sonraki
          </Button>
        </div>
      )}
    </Card>
  );
}
