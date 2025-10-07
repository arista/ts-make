import * as C from "./Config"
import * as M from "./Model"
import * as Utils from "./utils/Utils"

export function configToModel(props: {config: C.Config, basedir: string})/*:M.Model*/ {
  const {config, basedir} = props
  const builder = new ModelBuilder(basedir)

  // Prepare the target builders
  for(const targetConfig of config.targets ?? []) {
    const {name} = targetConfig
    const target = new TargetBuilder(name, targetConfig)
    builder.targetBuilders.push(target)
    builder.targetBuildersByName.set(name, target)
  }

  // Fill in the dependencies
  for(const target of builder.targetBuilders) {
    const deps = toDeps(target.src.deps)
    for(const dname of deps) {
      const dep = builder.findTargetBuilder(dname)
      target.deps.push(dep)
    }
  }

  // Check for dependency cycles
  builder.checkForDepsCycles()

  // Build the actual targets
  builder.buildTargets()

  // Assign deps
  builder.assignDeps()

  const targets = builder.getTargets()
  const targetsByName = builder.getTargetsByName()
  return new M.Model(
    targets,
    targetsByName
  )
}

function toDeps(deps: string|Array<string>|null|undefined): Array<string> {
  if (deps == null) {
    return []
  }
  else if (typeof deps === "string") {
    return [deps]
  }
  else {
    return deps
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

  checkForDepsCycles() {
    for(const target of this.targetBuilders) {
      this.checkTargetForDepsCycle(target)
    }
  }

  checkTargetForDepsCycle(target: TargetBuilder, depsPath: Array<TargetBuilder> = []) {
    const newDeps = [...depsPath, target]
    for(const dep of target.deps) {
      if (newDeps.indexOf(dep) >= 0) {
        const depsStr = [...newDeps, dep].map(d=>d.name).join(" -> ")
        throw new Error(`Deps cycle detected: ${depsStr}`)
      }
      this.checkTargetForDepsCycle(dep, newDeps)
    }
  }

  buildTargets() {
    for (const target of this.targetBuilders) {
      this.targetsByBuilder.set(target, this.buildTarget(target))
    }
  }

  buildTarget(targetBuilder: TargetBuilder): M.Target {
//    const buildSrc = targetBuilder.src.build
//    const build = buildSrc == null ? null : this.buildBuild(targetBuilder, buildSrc)
    return new M.Target(targetBuilder.name, [])
  }

  // buildBuild(targetBuilder: TargetBuilder, build: C.Build): M.Build {
  //   switch (build.type) {
  //     case "esbuild":
  //       return this.buildESBuildTarget(targetBuilder, build)
  //   }
  // }

  // buildESBuildTarget(targetBuilder: TargetBuilder, build: C.ESBuild): M.ESBuild {
  //   const {source, destPrefix, metafile} = build
  //   const sourceAbs = Utils.resolvePath(this.basedir, source)
  //   if (!Utils.isFile(sourceAbs)) {
  //     throw new Error(`esbuild target "${targetBuilder.name}" specifies non-existent source file "${sourceAbs}"`)
  //   }

  //   const destPrefixAbs = Utils.resolvePath(this.basedir, destPrefix)
  //   return new M.ESBuild(
  //     sourceAbs,
  //     destPrefixAbs,
  //     metafile ?? false
  //   )
  // }

  findTarget(targetBuilder: TargetBuilder): M.Target {
    const ret = this.targetsByBuilder.get(targetBuilder)
    if (ret == null) {
      throw new Error(`Assertion failed: Target not found for TargetBuilder "${targetBuilder.name}"`)
    }
    return ret
  }

  assignDeps() {
    for(const targetBuilder of this.targetBuilders) {
      const target = this.findTarget(targetBuilder)

      for(const d of targetBuilder.deps) {
        const dtarget = this.findTarget(d)
        target.deps.push(dtarget)
      }
    }
  }

  getTargets(): Array<M.Target> {
    return this.targetBuilders.map(t=>this.findTarget(t))
  }

  getTargetsByName(): Map<string, M.Target> {
    const ret = new Map<string, M.Target>()
    for(const [name, targetBuilder] of this.targetBuildersByName.entries()) {      ret.set(name, this.findTarget(targetBuilder))
    }
    return ret
  }
}

class TargetBuilder {
  deps: Array<TargetBuilder> = []
  constructor(public name: string, public src: C.Target) {}
}
