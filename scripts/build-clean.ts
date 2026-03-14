import { rm } from "fs/promises";
import { join } from "path";

rm(join(process.cwd(), "dist"), { recursive: true, force: true });
