import * as ConfigLoader from "./ConfigLoader"
import * as Utils from "./utils/Utils"
import * as M from "./Model"
import {loadConfig} from "./ConfigLoader"
import {configToModel} from "./ConfigToModel"

export async function make(props: {
  configFile?: string|null,
  target?: string|null,
}) {
  const {configFile} = props
  const targetName = props.target
  const basedir = Utils.getProjectRoot()
  const config = await ConfigLoader.loadConfig({ configFile })
  const model = configToModel({config, basedir})
  const context = new MakeContext(model, targetName ?? null)
  await context.run()
}

export class MakeContext {
  constructor(
    public model: M.Model,
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
    console.log(`[ts-make] target ${target.name}: build complete`)
  }
}

class BuildVisitor implements M.IBuildVisitor {
  constructor(
    target: M.Target
  ) {}
              
  visitESBuild(build: M.ESBuild) {
    // FIXME - implement this
  }
}
