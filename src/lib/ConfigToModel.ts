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
      const dependency = builder.findTargetBuilder(dname)
      target.depends.push(dependency)
    }
  }

  // Check for dependency cycles
  builder.checkForDependsCycles()

  // Build the actual targets
  builder.buildTargets()

  // Assign dependents
  builder.assignDepends()

  // Set up the defaultTarget
  const defaultTargetBuilder = config.defaultTarget == null ? null : builder.findTargetBuilder(config.defaultTarget)
  const defaultTarget = defaultTargetBuilder == null ? null : builder.findTarget(defaultTargetBuilder)

  const targets = builder.getTargets()
  const targetsByName = builder.getTargetsByName()
  return new M.Model(
    targets,
    targetsByName,
    defaultTarget
  )
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
  targetsByBuilder = new Map<TargetBuilder, M.Target>()

  constructor(public basedir: string) {
  }

  findTargetBuilder(name: string): TargetBuilder {
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

  buildTarget(targetBuilder: TargetBuilder): M.Target {
    const buildSrc = targetBuilder.src.build
    const build = buildSrc == null ? null : this.buildBuild(targetBuilder, buildSrc)
    return new M.Target([], build)
  }

  buildBuild(targetBuilder: TargetBuilder, build: C.Build): M.Build {
    switch (build.type) {
      case "esbuild":
        return this.buildESBuildTarget(targetBuilder, build)
    }
  }

  buildESBuildTarget(targetBuilder: TargetBuilder, build: C.ESBuild): M.ESBuild {
    const {depends} = targetBuilder
    const {source, destPrefix} = build
    const dependsTargets = depends.map(d=>this.targetsByBuilder)
    
    const sourceAbs = Utils.resolvePath(this.basedir, source)
    if (!Utils.isFile(sourceAbs)) {
      throw new Error(`esbuild target "${targetBuilder.name}" specifies non-existent source file "${sourceAbs}"`)
    }

    const destPrefixAbs = Utils.resolvePath(this.basedir, destPrefix)
    return new M.ESBuild(
      sourceAbs,
      destPrefixAbs
    )
  }

  findTarget(targetBuilder: TargetBuilder): M.Target {
    const ret = this.targetsByBuilder.get(targetBuilder)
    if (ret == null) {
      throw new Error(`Assertion failed: Target not found for TargetBuilder "${targetBuilder.name}"`)
    }
    return ret
  }

  assignDepends() {
    for(const targetBuilder of this.targetBuilders) {
      const target = this.findTarget(targetBuilder)

      for(const d of targetBuilder.depends) {
        const dtarget = this.findTarget(d)
        target.depends.push(dtarget)
      }
    }
  }

  getTargets(): Array<M.Target> {
    return this.targetBuilders.map(t=>this.findTarget(t))
  }

  getTargetsByName(): Map<string, M.Target> {
    const ret = new Map<string, M.Target>()
    for(const [name, targetBuilder] of Object.entries(this.targetBuildersByName)) {
      ret.set(name, this.findTarget(targetBuilder))
    }
    return ret
  }
}

class TargetBuilder {
  depends: Array<TargetBuilder> = []
  constructor(public name: string, public src: C.Target) {}
}
