import fs from "fs/promises";

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}
