"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function ProfileSettingsPage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const plan = (session?.user as { plan?: string })?.plan || "FREE";
  const initials = (session?.user?.name || session?.user?.email || "?")
    .slice(0, 1)
    .toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Profil diperbarui");
    } catch {
      toast.error("Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-xl">
      <CardBody className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-lg font-semibold text-foreground ring-1 ring-inset ring-border-strong">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">
                {session?.user?.name || "Tanpa Nama"}
              </p>
              <Badge tone={plan === "FREE" ? "neutral" : "success"}>{plan}</Badge>
            </div>
            <p className="truncate text-sm text-muted">{session?.user?.email}</p>
          </div>
        </div>

        <Field label="Nama">
          <Input
            value={name || session?.user?.name || ""}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama Anda"
          />
        </Field>

        <Field label="Email" hint="Email dikelola oleh penyedia Google OAuth.">
          <Input value={session?.user?.email || ""} disabled />
        </Field>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </CardBody>
    </Card>
  );
}
