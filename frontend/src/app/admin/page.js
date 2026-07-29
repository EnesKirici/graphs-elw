"use client";

import StatsOverview from "@/components/admin/StatsOverview";
import BanAlerts from "@/components/admin/BanAlerts";

export default function AdminDashboardPage() {
  return (
    <>
      <BanAlerts />
      <StatsOverview />
    </>
  );
}
