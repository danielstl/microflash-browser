/**
 * Represents special states for entries within the file allocation table.
 * Normally, the value for each block's allocation table entry is the next
 * block number to facilitate reading files. However, each entry may also
 * be one of these values
 */
export enum BlockInfoFlag {

    Unused = 0xffff,
    EndOfFile = 0xefff,
    Deleted = 0x0000
}