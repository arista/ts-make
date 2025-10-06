export class Model {

  constructor(
    public targets: Array<Target>,
    public targetsByName: Map<string, Target>,
    public defaultTarget: Target|null,
  ) {}
}

export class Target {
  constructor(
    public name: string,
    public depends:Array<Target>,
    public build: Build|null
  ) {}
}

export abstract class Build {
  visit(visitor: IBuildVisitor):void {}
}

export interface IBuildVisitor {
  visitESBuild(build: ESBuild): void
}

export class ESBuild extends Build {
  constructor(
    source: string,
    destPrefix: string
  ) {
    super()
  }
  
  override visit(visitor: IBuildVisitor):void {
    visitor.visitESBuild(this)
  }
}
