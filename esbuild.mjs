import {runESBuild} from "./esbuild.base.mjs"

await runESBuild([
  { name: "lib", entryPoint: "./src/lib.ts", outfile: "./dist/lib/lib.es.js" },
  { name: "cli", entryPoint: "./src/cli.ts", outfile: "./dist/cli/cli.es.js" },
])
