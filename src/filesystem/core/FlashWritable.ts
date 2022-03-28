import {MemorySpan} from "@/filesystem/utils/MemorySpan";

/**
 * Allows classes which implement this to support writing their state to
 * the filesystem in raw bytes
 */
export interface FlashWritable {

    writeToFlash(flash: MemorySpan): void;
}