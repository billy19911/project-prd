"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play, Save, Loader2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea, Select, Field } from "@/components/ui/input";

type AiConfig = {
  id: string;
  mindmapModel: string;
  prdModel: string;
  systemPrompt: string;
};

type Model = { id: string; name: string };

const FALLBACK_MODELS: Model[] = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
];

export default function AIConfigPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<Model[]>(FALLBACK_MODELS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [testPrompt, setTestPrompt] = useState(
    "Buat ringkasan 1 paragraf untuk aplikasi e-commerce berbasis Next.js."
  );
  const [testModel, setTestModel] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ai-config")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data.config);
        setTestModel(data.config?.prdModel || "");
        if (data.availableModels?.length) setAvailableModels(data.availableModels);
      })
      .catch(() => toast.error("Gagal memuat config"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      toast.success("AI config tersimpan");
    } catch {
      toast.error("Gagal menyimpan AI config");
    } finally {
      setSaving(false);
    }
  };

  const runSandbox = async () => {
    if (!config) return;
    setRunning(true);
    setOutput("");
    try {
      const res = await fetch("/api/admin/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: testPrompt,
          systemPrompt: config.systemPrompt,
          model: testModel || config.prdModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal");
      setOutput(data.text);
      toast.success(
        `Selesai (${data.usage?.promptTokens ?? 0}+${data.usage?.completionTokens ?? 0} token)`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menjalankan sandbox");
    } finally {
      setRunning(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Configuration &amp; Sandbox"
        description="Pilih model & uji System Prompt secara real-time tanpa re-deploy."
      />

      {/* Models */}
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Model untuk Mindmap">
            <Select
              value={config.mindmapModel}
              onChange={(e) => setConfig({ ...config, mindmapModel: e.target.value })}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Model untuk Full PRD">
            <Select
              value={config.prdModel}
              onChange={(e) => setConfig({ ...config, prdModel: e.target.value })}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      {/* Sandbox */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Live System Prompt Sandbox
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={testModel}
              onChange={(e) => setTestModel(e.target.value)}
              className="h-8 w-auto text-xs"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Button variant="success" size="sm" onClick={runSandbox} disabled={running}>
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Test
            </Button>
          </div>
        </CardHeader>

        <div className="grid lg:grid-cols-2">
          <div className="space-y-4 border-b border-border p-4 lg:border-b-0 lg:border-r">
            <Field label="System Prompt">
              <Textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                rows={8}
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Test Input">
              <Textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </Field>
          </div>

          <div className="p-4">
            <p className="mb-2 text-xs font-medium text-muted">Output</p>
            <pre className="h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/80 p-3 text-xs leading-relaxed text-muted lg:h-[calc(100%-1.75rem)]">
              {running ? "Menghubungi model..." : output || "Output akan muncul di sini."}
            </pre>
          </div>
        </div>
      </Card>

      <Button onClick={save} disabled={saving}>
        <Save className="h-4 w-4" />
        {saving ? "Menyimpan..." : "Simpan Config"}
      </Button>
    </div>
  );
}
