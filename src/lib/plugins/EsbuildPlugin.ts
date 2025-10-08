import {z} from "zod"
import * as P from "../Plugin"
import * as esbuild from 'esbuild'
import fs from "node:fs"

const plugin = P.definePlugin(async host=>{
  host.registerAction("esbuild", new EsbuildAction())
})
export default plugin


export const EsbuildActionArgsSchema = z.object({
  source: z.string(),
  destPrefix: z.string(),
  metafile: z.boolean().optional(),
  compilerOptions: z.object({}).optional(),
}).strict()
export type EsbuildActionArgs = z.infer<typeof EsbuildActionArgsSchema>

export class EsbuildAction implements P.Action<EsbuildActionArgs> {
  get argsSchema() { return EsbuildActionArgsSchema }
  
  async run(args: EsbuildActionArgs, ctx: P.ActionContext) {
    const {source, destPrefix, metafile, compilerOptions} = args

    const contextConfig:esbuild.BuildOptions = {
      entryPoints: [source],
      bundle: true,
      outfile: `${destPrefix}.es.js`,
      platform: "node",
      target: "node18",
      packages: "bundle",// FIXME - different for lambdas - isLambda ? "bundle" : "external",
      external: [], // FIXME - different for lambdas - isLambda ? ["aws-sdk"] : [...prismaExcludes],
      sourcemap: true,
      format: "esm",
      logLevel: "info",
      tsconfigRaw: {
        compilerOptions: {
          jsx: "preserve",
          paths: {},
          strict: true,
          target: "esnext",
          ...(compilerOptions ?? {}),
        }
      },
      metafile,
      logOverride: {
        // Don't report dynamic import() statements, used by the cli
        "unsupported-dynamic-import": "silent",
      },
    }
    const context = await esbuild.context(contextConfig)
    ctx.log(`running initial esbuild`)
    const result = await context.rebuild()
    if (metafile) {
      fs.writeFileSync(
        `${destPrefix}.metafile.json`,
        JSON.stringify(result.metafile, null, 2)
      )
    }
    if (!ctx.watch) {
      // End immediately
      await context.dispose()
    }
    else {
      ctx.log(`watching for changes`)
      await context.watch()

      // Register shutdown handler
      const shutdown = async (signal:string) =>{
        ctx.log(`cleaning up...`)
        await context.dispose()
      }
      process.on("SIGINT", () => shutdown('SIGINT'))
      process.on("SIGTERM", () =>shutdown('SIGTERM'))

      // Keep the process alive with a Promise that never resolves
      await new Promise(()=>{})
    }
  }
}
