import * as M from "./Model"

export class BuildPlan {
  constructor(
    public target: BuildTarget
  ) {}

  *getBuildSteps():IterableIterator<BuildStep> {
    yield *this.target.getBuildSteps()
  }
}

export class BuildTarget {
  constructor(
    public target: M.Target,
    public deps: Array<BuildTargetDep>
  ) {}

  *getBuildSteps():IterableIterator<BuildStep> {
    yield {type: "BeginTarget", target: this.target}
    yield {type: "BeginBuildTargetDependencies", target: this.target, deps: this.deps}
    yield {type: "EndBuildTargetDependencies", target: this.target, deps: this.deps}
    for(const dep of this.deps) {
      switch(dep.type) {
        case "CompletedBuildTargetDep":
          yield {type: "SkipCompleteTargetDependency", target: this.target, dep: dep.target}
          break
        case "IncompleteBuildTargetDep":
          yield {type: "BuildTargetDependency", target: this.target, dep: dep.buildTarget.target}
          yield *dep.buildTarget.getBuildSteps()
          break
        default:
          const unexpected:never = dep
      }
    }
    yield {type: "BuildTarget", target: this.target}
    yield {type: "EndTarget", target: this.target}
  }
}

export type BuildTargetDep =
  CompletedBuildTargetDep
  | IncompleteBuildTargetDep

export type CompletedBuildTargetDep = {
  type: "CompletedBuildTargetDep"
  target: M.Target
}

export type IncompleteBuildTargetDep = {
  type: "IncompleteBuildTargetDep"
  buildTarget: BuildTarget
}

export function createBuildPlan(makeSpec: M.MakeSpec, targetName: string|null): BuildPlan {
  const target = makeSpec.getTargetOrDefault(targetName)
  const completes = new Set<M.Target>
  const buildTarget = createBuildTarget(target, completes)
  return new BuildPlan(buildTarget)
}

function createBuildTarget(target: M.Target, completes: Set<M.Target>): BuildTarget {
  const deps = new Array<BuildTargetDep>()
  for(const dep of target.deps) {
    if (completes.has(dep)) {
      deps.push({type: "CompletedBuildTargetDep", target: dep})
    }
    else {
      const depBuildTarget = createBuildTarget(dep, completes)
      deps.push({type: "IncompleteBuildTargetDep", buildTarget: depBuildTarget})
    }
  }
  completes.add(target)
  return new BuildTarget(target, deps)
}

export type BuildStep =
  BeginTargetBuildStep
  | EndTargetBuildStep
  | BeginBuildTargetDependenciesBuildStep
  | EndBuildTargetDependenciesBuildStep
  | BuildTargetDependencyBuildStep
  | SkipCompleteTargetDependencyBuildStep
  | BuildTargetBuildStep

export type BeginTargetBuildStep = {
  type: "BeginTarget"
  target: M.Target
}

export type BeginBuildTargetDependenciesBuildStep = {
  type: "BeginBuildTargetDependencies"
  target: M.Target
  deps: Array<BuildTargetDep>
}

export type EndBuildTargetDependenciesBuildStep = {
  type: "EndBuildTargetDependencies"
  target: M.Target
  deps: Array<BuildTargetDep>
}

export type BuildTargetDependencyBuildStep = {
  type: "BuildTargetDependency"
  target: M.Target
  dep: M.Target
}

export type SkipCompleteTargetDependencyBuildStep = {
  type: "SkipCompleteTargetDependency"
  target: M.Target
  dep: M.Target
}

export type BuildTargetBuildStep = {
  type: "BuildTarget"
  target: M.Target
}

export type EndTargetBuildStep = {
  type: "EndTarget"
  target: M.Target
}

export function buildStepToString(step: BuildStep): string {
  switch(step.type) {
    case "BeginTarget":
      return `${step.target.name} - begin`
    case "BeginBuildTargetDependencies":
      return `${step.target.name} -   build ${step.deps.length} dependencies`
    case "EndBuildTargetDependencies":
      return `${step.target.name} -   end ${step.deps.length} dependencies`
    case "BuildTargetDependency":
      return `${step.target.name} -     build depedency "${step.dep.name}"`
    case "SkipCompleteTargetDependency":
      return `${step.target.name} -     skipping depedency "${step.dep.name}" built previously`
    case "BuildTarget":
      return `${step.target.name} -   building`
    case "EndTarget":
      return `${step.target.name} - end`
  }
}
