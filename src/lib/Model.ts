export class Model {

  constructor(
    public targets: Array<Target>,
    public targetsByName: Map<string, Target>,
  ) {}
}

export class Target {
  constructor(
    public name: string,
    public deps: Array<Target>,
  ) {}
}
