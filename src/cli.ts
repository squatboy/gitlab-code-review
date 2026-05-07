#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { runReview } from "./review/runner.js";

const program = new Command()
  .name("ai-code-review")
  .description("Run AI code review for a GitLab merge request")
  .option("--strict", "exit with non-zero status when review fails")
  .action(async (options: { strict?: boolean }) => {
    const config = loadConfig();
    const result = await runReview(config);

    if (options.strict && result.status === "failed") {
      process.exitCode = 1;
      return;
    }

    process.exitCode = 0;
  });

await program.parseAsync(process.argv);
