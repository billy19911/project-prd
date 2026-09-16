#!/usr/bin/env node

import { Command } from "commander";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

const program = new Command();

program
  .name("xynn")
  .description("XynnPrototype CLI sync engine")
  .version("0.1.0");

program
  .command("connect")
  .description("Sync PRD.md and .cursorrules into the current workspace")
  .requiredOption("--workspace <id>", "Xynn workspace ID")
  .option("--api-key <key>", "Xynn API key")
  .option("--server <url>", "Xynn server URL", process.env.XYNN_SERVER_URL || "http://localhost:3000")
  .action(async (options) => {
    const apiKey = options.apiKey || process.env.XYNN_API_KEY;
    if (!apiKey) {
      throw new Error("API key wajib diisi lewat --api-key atau XYNN_API_KEY");
    }

    const response = await axios.get(`${options.server}/api/cli/sync`, {
      params: { workspace: options.workspace },
      headers: { "x-api-key": apiKey },
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      throw new Error(response.data?.error || `Sync gagal (${response.status})`);
    }

    const outputDir = process.cwd();
    await fs.writeFile(path.join(outputDir, "PRD.md"), response.data.prd, "utf8");
    await fs.writeFile(path.join(outputDir, ".cursorrules"), response.data.cursorRules, "utf8");

    console.log(`PRD.md dan .cursorrules tersimpan di ${outputDir}`);
  });

program.parseAsync().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});