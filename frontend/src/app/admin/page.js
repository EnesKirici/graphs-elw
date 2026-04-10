"use client";

import StatsOverview from "@/components/admin/StatsOverview";

export default function AdminDashboardPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Site analitikleri ve genel bakış</p>
      </div>
      <StatsOverview />
    </>
  );
}
