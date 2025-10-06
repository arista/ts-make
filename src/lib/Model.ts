export class Model {

  constructor(
    public targets: Array<Target>,
    public targetsByName: Map<string, Target>,
    public defaultTarget: Target|null,
  ) {}
}

export class Target {
  constructor(
    public depends:Array<Target>
  ) {}
}

export class EsBuildTarget extends Target {
  constructor(
    depends:Array<Target>,
    source: string,
    destPrefix: string
  ) {
    super(depends)
  }
}
