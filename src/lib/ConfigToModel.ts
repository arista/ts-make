import * as C from "./Config"
import * as M from "./Model"
import * as Utils from "./utils/Utils"

export function configToModel(props: {config: C.Config, basedir: string})/*:M.Model*/ {
  const {config, basedir} = props
  const builder = new ModelBuilder(basedir)

  // Prepare the target builders
  for(const [name, targetConfig] of Object.entries(config.targets ?? {})) {
    const target = new TargetBuilder(name, targetConfig)
    builder.targetBuilders.push(target)
    builder.targetBuildersByName.set(name, target)
  }

  // Fill in the dependencies
  for(const target of builder.targetBuilders) {
    const depends = toDepends(target.src.depends)
    for(const dname of depends) {
      const dependency = builder.findTarget(dname)
      target.depends.push(dependency)
    }
  }

  // Set up the defaultTarget
  const defaultTarget = (config.defaultTarget && builder.findTarget(config.defaultTarget)) ?? null

  // Check for dependency cycles
  builder.checkForDependsCycles()

  // Build the actual targets
  builder.buildTargets()
}

function toDepends(depends: string|Array<string>|null|undefined): Array<string> {
  if (depends == null) {
    return []
  }
  else if (typeof depends === "string") {
    return [depends]
  }
  else {
    return depends
  }
}

class ModelBuilder {
  targetBuilders: Array<TargetBuilder> = []
  targetBuildersByName = new Map<string, TargetBuilder>()
  targetsByBuilder = new Map<TargetBuilder, M.Target|null>()

  constructor(public basedir: string) {
  }

  findTarget(name: string): TargetBuilder {
    const ret = this.targetBuildersByName.get(name)
    if (ret == null) {
      throw new Error(`Target "${name}" not found`)
    }
    else {
      return ret
    }
  }

  checkForDependsCycles() {
    for(const target of this.targetBuilders) {
      this.checkTargetForDependsCycle(target)
    }
  }

  checkTargetForDependsCycle(target: TargetBuilder, dependsPath: Array<TargetBuilder> = []) {
    const newDepends = [...dependsPath, target]
    for(const depend of target.depends) {
      if (newDepends.indexOf(depend) >= 0) {
        const dependsStr = [...newDepends, depend].map(d=>d.name).join(" -> ")
        throw new Error(`Depends cycle detected: ${dependsStr}`)
      }
      this.checkTargetForDependsCycle(depend, newDepends)
    }
  }

  buildTargets() {
    for (const target of this.targetBuilders) {
      this.targetsByBuilder.set(target, this.buildTarget(target))
    }
  }

  buildTarget(targetBuilder: TargetBuilder): M.Target | null {
    const build = targetBuilder.src.build
    if (build == null) {
      return null
    }
    else {
      switch (build.type) {
        case "esbuild":
          return this.buildEsBuildTarget(targetBuilder, build)
      }
    }
  }

  buildEsBuildTarget(targetBuilder: TargetBuilder, build: C.ESBuild): M.EsBuildTarget {
    const {depends} = targetBuilder
    const {source, destPrefix} = build

    const sourceAbs = Utils.resolvePath(this.basedir, source)
    if (!Utils.isFile(sourceAbs)) {
      throw new Error(`esbuild target "${targetBuilder.name}" specifies non-existent source file "${sourceAbs}"`)
    }

    const destPrefixAbs = Utils.resolvePath(this.basedir, destPrefix)
    return new M.EsBuildTarget(
      depends,
      sourceAbs,
      destPrefixAbs
    )
  }
}

class TargetBuilder {
  depends: Array<TargetBuilder> = []
  constructor(public name: string, public src: C.Target) {}
}
