import {z} from "zod"

export const ESBuildSchema = z.object({
  type: z.literal("esbuild"),
  source: z.string(),
  dest: z.string(),
})
export type ESBuild = z.infer<typeof ESBuildSchema>

export const BuildSchema = z.discriminatedUnion("type", [
  ESBuildSchema
])
export type Build = z.infer<typeof BuildSchema>

export const TargetSchema = z.object({
  depends: z.array(z.string()).optional().nullable(),
  build: BuildSchema.optional().nullable(),
})
export type Target = z.infer<typeof TargetSchema>

export const ConfigSchema = z.object({
  targets: z.record(z.string(), TargetSchema),
  defaultTarget: z.string().optional().nullable(),
})
export type Config = z.infer<typeof ConfigSchema>
