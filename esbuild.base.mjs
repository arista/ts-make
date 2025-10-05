import * as esbuild from 'esbuild'

export async function runESBuild(builds) {
  // test for watch mode
  let watch = false
  for(const arg of process.argv.slice(2)) {
    if (arg === "-w" || arg === "--watch") {
      watch = true
    }
  }

  await Promise.all(builds.map(build => (async ()=>{
    const config = {
      "entryPoints": [build.entryPoint],
      "bundle": true,
      "outfile": build.outfile,
      "platform": "node",
      "target": "node18",
      "packages": "external",
      "sourcemap": true,
      "format": "esm",
      "logLevel": "info",
      "tsconfigRaw": {
        "compilerOptions": {
          "jsx": "preserve",
          "paths": {},
          "strict": true,
          "target": "esnext"
        }
      },
      "metafile": false,
      "logLevel": "info",
      "logOverride": {
        // Don't report dynamic import() statements, used by the cli
        "unsupported-dynamic-import": "silent",
      },
    }
    const context = await esbuild.context(config)
    if (watch) {
      console.log(`[esbuild] ${build.name} - watching for changes`)
      await context.watch()

      // Register shutdown handler
      const shutdown = async (signal) =>{
        console.log(`[esbuild] ${build.name} - Cleaning up...`)
        await context.dispose()
        process.exit(0)
      }
      process.on("SIGINT", () => shutdown('SIGINT'))
      process.on("SIGTERM", () =>shutdown('SIGTERM'))

      // Keep the process alive with a Promise that never resolves
      await new Promise(()=>{})
    }
    else {
      console.log(`[esbuild] ${build.name} - Running initial build`)
      await context.rebuild()
      await context.dispose()
      console.log(`[esbuild] ${build.name} - Initial build complete`)
    }
  })()))
}
