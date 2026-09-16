import { PageHeader } from "@/components/ui/page-header";
import { SettingsNav } from "@/components/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Kelola langganan, profil, dan integrasi developer Anda."
      />
      <SettingsNav />
      {children}
    </div>
  );
}
