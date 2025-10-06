import * as ConfigLoader from "./ConfigLoader"
import * as Utils from "./utils/Utils"
import * as M from "./Model"
import * as esbuild from 'esbuild'
import fs from "node:fs"
import {loadConfig} from "./ConfigLoader"
import {configToModel} from "./ConfigToModel"

export async function make(props: {
  configFile?: string|null,
  target?: string|null,
  watch?: boolean|null,
}) {
  const {configFile, watch} = props
  const targetName = props.target
  const basedir = Utils.getProjectRoot()
  const config = await ConfigLoader.loadConfig({ configFile })
  const model = configToModel({config, basedir})
  const context = new MakeContext(model, watch ?? false, targetName ?? null)
  await context.run()
}

export class MakeContext {
  constructor(
    public model: M.Model,
    public watch: boolean,
    public startingTargetName: string|null
  ) {}

  getStartingTarget(targetName: string|null) {
    if (targetName != null) {
      const ret = this.model.targetsByName.get(targetName)
      if (ret == null) {
        throw new Error(`Target "${targetName}" not found`)
      }
      return ret
    }
    else if (this.model.defaultTarget != null) {
      return this.model.defaultTarget
    }
    else {
      // See if there's a target named "default"
      const ret = this.model.targetsByName.get("default")
      if (ret != null) {
        return ret
      }
      else {
        throw new Error(`No target specified and no defaultTarget, or target named "default", specified in the configuration file`)
      }
    }
  }

  async run() {
    const startingTarget = this.getStartingTarget(this.startingTargetName)
    const buildOrder = this.generateBuildTargetOrder(startingTarget)
    for(const target of buildOrder) {
      await this.buildTarget(target)
    }
  }

  generateBuildTargetOrder(startingTarget: M.Target):Array<M.Target> {
    // Get the full list of targets in order, then deduplicate
    function getFullTargetTree(t: M.Target): Array<M.Target> {
      return [...t.depends.map(d=>getFullTargetTree(d)).flat(1), t]
    }
    const fullTargetTree = getFullTargetTree(startingTarget)
    const completeTargets = new Set<M.Target>()

    const ret:Array<M.Target> = []
    for(const t of fullTargetTree) {
      if (!completeTargets.has(t)) {
        ret.push(t)
        completeTargets.add(t)
      }
    }
    return ret
  }

  async buildTarget(target: M.Target) {
    console.log(`[ts-make] target ${target.name}: starting build`)
    const build = target.build
    if (build != null) {
      const visitor = new BuildVisitor(this, target)
      build.visit(visitor)
    }
    console.log(`[ts-make] target ${target.name}: build complete`)
  }
}

class BuildVisitor implements M.IBuildVisitor {
  constructor(
    public ctx: MakeContext,
    public target: M.Target
  ) {}

  log(str: string) {
    console.log(`[ts-make] target ${this.target.name}: ${str}`)
  }
              
  async visitESBuild(build: M.ESBuild):Promise<void> {
    const {source, destPrefix, metafile} = build

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
        "compilerOptions": {
          "jsx": "preserve",
          "paths": {},
          "strict": true,
          "target": "esnext"
        }
      },
      metafile,
      logOverride: {
        // Don't report dynamic import() statements, used by the cli
        "unsupported-dynamic-import": "silent",
      },
    }
    const context = await esbuild.context(contextConfig)
    this.log(`running initial esbuild`)
    const result = await context.rebuild()
    if (metafile) {
      fs.writeFileSync(
        `${destPrefix}.metafile.json`,
        JSON.stringify(result.metafile, null, 2)
      )
    }
    if (this.ctx.watch) {
      this.log(`watching for changes`)
      await context.watch()

      // Register shutdown handler
      const shutdown = async (signal:string) =>{
        this.log(`cleaning up...`)
        await context.dispose()
      }
      process.on("SIGINT", () => shutdown('SIGINT'))
      process.on("SIGTERM", () =>shutdown('SIGTERM'))

      // Keep the process alive with a Promise that never resolves
      await new Promise(()=>{})

    }
    else {
      await context.dispose()
    }
  }
}
