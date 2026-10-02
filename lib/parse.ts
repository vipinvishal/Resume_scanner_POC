import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED = ".pdf,.docx,.txt,.md";

/** Turn an uploaded PDF / DOCX / TXT into clean text. Throws friendly errors. */
export async function fileToText(file: File): Promise<string> {
  if (file.size === 0) throw new Error(`"${file.name}" is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" is larger than 8 MB.`);
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let text = "";

  try {
    if (name.endsWith(".pdf")) {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const out = await extractText(pdf, { mergePages: true });
      text = out.text;
    } else if (name.endsWith(".docx")) {
      text = (await mammoth.extractRawText({ buffer: buf })).value;
    } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
      text = buf.toString("utf8");
    } else if (name.endsWith(".doc")) {
      throw new Error(`"${file.name}" is an old .doc file. Please save it as .docx or PDF.`);
    } else {
      throw new Error(`"${file.name}" is not supported. Use PDF, DOCX or TXT.`);
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("not supported") || msg.includes("old .doc")) throw e;
    throw new Error(`Couldn't read "${file.name}". The file may be damaged or password-protected.`);
  }

  text = text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < 60)
    throw new Error(`"${file.name}" has almost no readable text. It may be a scanned image — scanned PDFs aren't supported yet.`);
  return text;
}
