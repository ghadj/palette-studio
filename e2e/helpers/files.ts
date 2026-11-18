import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { JSHandle, Page } from "@playwright/test";

export const fixture = (name: string): string => resolve(process.cwd(), "tests/fixtures", name);

/** A DataTransfer in the page holding one file, for drop and paste events. */
export async function dataTransferWith(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<JSHandle<DataTransfer>> {
  return page.evaluateHandle(
    ({ b64, name, type }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type }));
      return dt;
    },
    { b64: file.buffer.toString("base64"), name: file.name, type: file.mimeType },
  );
}

export const fixtureFile = (name: string, mimeType: string) => ({
  name,
  mimeType,
  buffer: readFileSync(fixture(name)),
});
