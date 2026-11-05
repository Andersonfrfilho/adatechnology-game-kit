/** The repository root of the kit. */
export declare const KIT_ROOT: string
/** The references the kit keeps in git: the manifest and the credits of every file. */
export declare const KIT_SFX_MANIFEST_DIR: string
/** The folder of the converted files (`<categoria>/<nome>.ogg`) on this machine, whether it exists or not. */
export declare function kitSfxDir(root?: string): string
/** The folder of the originals the converter reads, whether it exists or not. */
export declare function kitSfxInbox(root?: string): string
/** Whether this machine has the kit's files. */
export declare function hasKitSfx(root?: string): boolean
