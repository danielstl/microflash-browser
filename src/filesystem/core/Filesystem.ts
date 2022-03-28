import {Directory} from "@/filesystem/Filesystem";

export interface Filesystem {

    load(): Directory;
}