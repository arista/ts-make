import * as ConfigLoader from "./ConfigLoader"
import * as Utils from "./utils/Utils"
import * as M from "./Model"
import * as esbuild from 'esbuild'
import fs from "node:fs"
import {loadConfig} from "./ConfigLoader"
import * as ModelBuilder from "./ModelBuilder"
import * as BuildPlan from "./BuildPlan"
import * as P from "./Plugin"

export async function make(props: {
  configFile?: string|null,
  target?: string|null,
  watch?: boolean|null,
}) {
  const {configFile, watch} = props
  const targetName = props.target
  const config = await ConfigLoader.loadConfig({ configFile })
  const modelBuildCtx = new ModelBuilder.ModelBuilderContext(config.baseDir)
  const makeSpec = await ModelBuilder.buildModel(config.makeSpec, modelBuildCtx)

  const make = new Make(
    modelBuildCtx,
    makeSpec,
    targetName ?? null
  )

  await make.build()
}

class Make {
  constructor(
    public modelBuilderContext: ModelBuilder.ModelBuilderContext,
    public makeSpec: M.MakeSpec,
    public targetName: string|null,
  ) {}

  async build() {
    const buildPlan = BuildPlan.createBuildPlan(this.makeSpec, this.targetName ?? null)

    for (const buildStep of buildPlan.getBuildSteps()) {
      // console.log(BuildPlan.buildStepToString(buildStep))
      if (buildStep.type === "BuildTarget") {
        await this.buildTarget(buildStep.target)
      }
    }
  }

  async buildTarget(target: M.Target) {
    const {action} = target
    if (action != null) {
      const ctx = new MakeActionContext()

      // Run the action
      await action.action.run(target.args, ctx)
    }
  }
}

class MakeActionContext implements P.ActionContext {
}


//   async buildTarget(target: M.Target) {
//     console.log(`[ts-make] target ${target.name}: starting build`)
//     // const action = target.action
//     // if (action != null) {
//     //   // FIXME - implement this
//     // }
//     console.log(`[ts-make] target ${target.name}: build complete`)/
//   }
// }

// class BuildVisitor implements M.IBuildVisitor {
//   constructor(
//     public ctx: MakeContext,
//     public target: M.Target
//   ) {}

//   log(str: string) {
//     console.log(`[ts-make] target ${this.target.name}: ${str}`)
//   }
              
//   async visitESBuild(build: M.ESBuild):Promise<void> {
//     const {source, destPrefix, metafile} = build

//     const contextConfig:esbuild.BuildOptions = {
//       entryPoints: [source],
//       bundle: true,
//       outfile: `${destPrefix}.es.js`,
//       platform: "node",
//       target: "node18",
//       packages: "bundle",// FIXME - different for lambdas - isLambda ? "bundle" : "external",
//       external: [], // FIXME - different for lambdas - isLambda ? ["aws-sdk"] : [...prismaExcludes],
//       sourcemap: true,
//       format: "esm",
//       logLevel: "info",
//       tsconfigRaw: {
//         "compilerOptions": {
//           "jsx": "preserve",
//           "paths": {},
//           "strict": true,
//           "target": "esnext"
//         }
//       },
//       metafile,
//       logOverride: {
//         // Don't report dynamic import() statements, used by the cli
//         "unsupported-dynamic-import": "silent",
//       },
//     }
//     const context = await esbuild.context(contextConfig)
//     this.log(`running initial esbuild`)
//     const result = await context.rebuild()
//     if (metafile) {
//       fs.writeFileSync(
//         `${destPrefix}.metafile.json`,
//         JSON.stringify(result.metafile, null, 2)
//       )
//     }
//     if (!this.ctx.watch) {
//       // End immediately
//       await context.dispose()
//     }
//     else {
//       this.log(`watching for changes`)
//       await context.watch()

//       // Register shutdown handler
//       const shutdown = async (signal:string) =>{
//         this.log(`cleaning up...`)
//         await context.dispose()
//       }
//       process.on("SIGINT", () => shutdown('SIGINT'))
//       process.on("SIGTERM", () =>shutdown('SIGTERM'))

//       // Keep the process alive with a Promise that never resolves
//       await new Promise(()=>{})
//     }
//   }
// }
