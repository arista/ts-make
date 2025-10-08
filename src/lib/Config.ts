import {z} from "zod"

// export const ESBuildSchema = z.object({
//   type: z.literal("esbuild"),
//   source: z.string(),
//   destPrefix: z.string(),
//   metafile: z.boolean().optional().nullable(),
// }).strict()
// export type ESBuild = z.infer<typeof ESBuildSchema>

// export const BuildSchema = z.discriminatedUnion("type", [
//   ESBuildSchema
// ])
// export type Build = z.infer<typeof BuildSchema>

export const TargetSchema = z.object({
  name: z.string(),
  deps: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  action: z.string().optional().nullable(),
  args: z.any(),
}).strict()
export type Target = z.infer<typeof TargetSchema>

export const FullPluginSchema = z.object({
  name: z.string(),
  alias: z.string().optional().nullable(),
})
export type FullPlugin = z.infer<typeof FullPluginSchema>
  
export const PluginSchema = z.union([z.string(), FullPluginSchema])
export type Plugin = z.infer<typeof PluginSchema>
  
export const ConfigSchema = z.object({
  plugins: z.array(PluginSchema).optional().nullable(),
  targets: z.array(TargetSchema).optional().nullable(),
}).strict()
export type Config = z.infer<typeof ConfigSchema>
