/**
 * Flags used to represent the state of directory entries
 */
export enum DirectoryEntryFlag {

    Free = 0x8000,
    Valid = 0x4000,
    Directory = 0x2000,
    New = 0xffff,
    Deleted = 0x0000
}