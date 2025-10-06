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
  async visit(visitor: IBuildVisitor):Promise<void> {}
}

export interface IBuildVisitor {
  visitESBuild(build: ESBuild): Promise<void>
}

export class ESBuild extends Build {
  constructor(
    public source: string,
    public destPrefix: string,
    public metafile: boolean
  ) {
    super()
  }
  
  override async visit(visitor: IBuildVisitor):Promise<void> {
    visitor.visitESBuild(this)
  }
}
