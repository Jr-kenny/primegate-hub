import { Buffer } from "buffer";
import process from "process";

const browserGlobals = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  global?: typeof globalThis;
  process?: typeof process;
};

if (!browserGlobals.Buffer) {
  browserGlobals.Buffer = Buffer;
}

if (!browserGlobals.global) {
  browserGlobals.global = globalThis;
}

if (!browserGlobals.process) {
  browserGlobals.process = process;
}
