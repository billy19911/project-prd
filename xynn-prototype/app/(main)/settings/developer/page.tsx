"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, KeyRound, Trash2, Terminal } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ApiKeyRow = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type WorkspaceInfo = {
  id: string;
  title: string;
  hasPrd: boolean;
  hasTasks: boolean;
  hasStyle: boolean;
  cliSync?: { lastSyncAt: string };
};

export default function DeveloperSettingsPage() {
  const [keyName, setKeyName] = useState("");
  // API key disimpan di localStorage agar tombol "Export & Sync" di project
  // bisa jalan sekali klik tanpa memasukkan key manual lagi.
  const [apiKey, setApiKey] = useState("");
  const [showRawKey, setShowRawKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [copied, setCopied] = useState(false);

  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  const fetchWorkspaces = async (key: string) => {
    try {
      setLoadingWorkspaces(true);
      const res = await fetch('/api/cli/workspaces', {
        headers: { 'x-api-key': key },
      });
      if (!res.ok) throw new Error();
      const data: WorkspaceInfo[] = await res.json();
      setWorkspaces(data);
    } catch {
      toast.error('Gagal mengambil daftar workspace');
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  // Muat key tersimpan sekali saat mount (dari localStorage), lalu ambil workspace.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('xynnApiKey') : null;
    if (!stored) return;
    let active = true;
    (async () => {
      setApiKey(stored);
      await fetchWorkspaces(stored);
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, []);

  // Simpan API key ke localStorage setiap kali berubah.
  useEffect(() => {
    if (apiKey && typeof window !== 'undefined') {
      localStorage.setItem('xynnApiKey', apiKey);
    }
  }, [apiKey]);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/developer/keys");
      if (!res.ok) throw new Error();
      setKeys(await res.json());
    } catch {
      toast.error("Gagal mengambil daftar API key");
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/developer/keys")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (active) setKeys(data);
      })
      .catch(() => toast.error("Gagal mengambil daftar API key"));
    return () => {
      active = false;
    };
  }, []);

  const handleGenerate = async () => {
    if (!keyName.trim()) {
      toast.error("Nama token wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApiKey(data.rawKey);
      setShowRawKey(true);
      setKeyName("");
      toast.success("API key berhasil dibuat");
      await fetchKeys();
    } catch {
      toast.error("Gagal membuat token");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("API key disalin");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch("/api/developer/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      toast.success("API key dicabut");
      if (apiKey) setApiKey("");
      await fetchKeys();
    } catch {
      toast.error("Gagal mencabut API key");
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted" />
            Generate API Key
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Nama Token" hint="cth: Laptop Kantor, Workstation Rumah">
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Nama deskriptif untuk token ini"
            />
          </Field>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Membuat..." : "Buat API Key"}
          </Button>
        </CardBody>
      </Card>

      {/* New key panel */}
      {apiKey && (
        <Card className="border-accent/30">
          <CardHeader>
            <CardTitle>API Key Baru</CardTitle>
            <Badge tone="warning">Tampil sekali</Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border-strong bg-background/80 p-3">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-accent sm:text-sm">
                {showRawKey ? apiKey : "•".repeat(30)}
              </code>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRawKey(!showRawKey)}
                >
                  {showRawKey ? "Sembunyikan" : "Tampilkan"}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted">
              Simpan key ini sekarang — hanya ditampilkan sekali. Gunakan di CLI:
            </p>
            <div className="overflow-x-auto rounded-lg border border-border-strong bg-background/80 p-3">
              <code className="whitespace-nowrap font-mono text-xs text-accent">
                xynn connect --api-key {apiKey.slice(0, 14)}... --workspace &lt;id&gt;
              </code>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Workspace CLI — auto-deteksi workspace & perintah siap tempel */}
      {apiKey && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted" />
              Sync ke Workspace
            </CardTitle>
            <span className="text-xs text-muted">
              {loadingWorkspaces ? "Memuat..." : `${workspaces.length} workspace`}
            </span>
          </CardHeader>
          <CardBody className="space-y-2">
            {!loadingWorkspaces && workspaces.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Belum ada workspace. Buat project dulu.
              </p>
            ) : (
              workspaces.map((ws) => {
                const cmd = `xynn connect --api-key ${apiKey} --workspace ${ws.id} --server ${typeof window !== "undefined" ? window.location.origin : ""}`;
                const steps = [
                  ws.hasPrd ? "PRD" : null,
                  ws.hasTasks ? "Task" : null,
                  ws.hasStyle ? "Style" : null,
                ].filter(Boolean);
                return (
                  <div
                    key={ws.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {ws.title}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {steps.length ? `Siap: ${steps.join(", ")}` : "Belum ada artifact"}
                        {ws.cliSync?.lastSyncAt
                          ? ` · Tersambung ${new Date(ws.cliSync.lastSyncAt).toLocaleDateString("id-ID")}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(cmd);
                        toast.success("Perintah CLI disalin");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Copy command</span>
                    </Button>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      )}

      {/* Key list */}
      <Card>
        <CardHeader>
          <CardTitle>API Key Terdaftar</CardTitle>
          <span className="text-xs text-muted">{keys.length} key</span>
        </CardHeader>
        <CardBody className="space-y-2">
          {keys.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Belum ada API key terdaftar.
            </p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {key.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    Dibuat {new Date(key.createdAt).toLocaleDateString("id-ID")}
                    {key.lastUsedAt
                      ? ` · Dipakai ${new Date(key.lastUsedAt).toLocaleDateString("id-ID")}`
                      : " · Belum dipakai"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(key.id)}
                  className="shrink-0 text-danger hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cabut</span>
                </Button>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* CLI instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted" />
            Integrasi CLI
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">
            Jalankan perintah di folder proyek lokal untuk menyinkronkan PRD, Task
            Breakdown, Style Guide, dan <code className="text-foreground">.cursorrules</code>.
            Satu perintah juga melaporkan progres kembali ke web.
          </p>
          <div className="space-y-2 font-mono text-xs">
            <div className="overflow-x-auto rounded-lg border border-border-strong bg-background/80 p-3 text-accent">
              xynn connect --api-key &lt;KEY&gt; --workspace &lt;ID&gt;
            </div>
            <div className="overflow-x-auto rounded-lg border border-border-strong bg-background/80 p-3 text-accent">
              xynn workspaces --api-key &lt;KEY&gt;
            </div>
          </div>
          <p className="text-xs text-muted">
            Menghasilkan file <code className="text-foreground">PRD.md</code>,{" "}
            <code className="text-foreground">tasks.md</code>,{" "}
            <code className="text-foreground">STYLEGUIDE.md</code>, dan{" "}
            <code className="text-foreground">.cursorrules</code>. Bila akun hanya punya
            satu workspace, <code className="text-foreground">--workspace</code> boleh
            dikosongkan (terdeteksi otomatis). Butuh Node.js &gt;= 18.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
