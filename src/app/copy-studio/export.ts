// CopySTUDIO · unified export utility.
// Drop-in for every WRITE / SHIP module. Same call signature regardless
// of source format.
//   await exportDraft(doc, { format: "docx" })
// docx via the existing `docx` dep, zip via jszip, file-saver for
// browser-side download. HTML / MD / TXT are pure-string serializers.

"use client";

import { saveAs } from "file-saver";
import JSZip from "jszip";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

export type ExportFormat = "docx" | "md" | "html" | "txt";

export interface ExportableDraft {
  title: string;
  html?: string;
  markdown?: string;
  plain?: string;
}

function slugify(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "draft";
}

// Strip HTML to plain text.
function stripHtml(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, " ");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

// Very small HTML → markdown.
function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  md = md.replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1\n\n");
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<(ul|ol)[^>]*>/gi, "");
  md = md.replace(/<\/(ul|ol)>/gi, "\n");
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<[^>]+>/g, "");
  md = md.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  return md.replace(/\n{3,}/g, "\n\n").trim();
}

// Build a docx Document from very simple body text. Headings / lists /
// bold / italic survive when the caller hands us either markdown or
// plain prose with newline-separated paragraphs.
function buildDocxFromMarkdown(title: string, markdown: string): Document {
  const lines = markdown.split(/\r?\n/);
  const children: Paragraph[] = [];
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }));
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { children.push(new Paragraph("")); continue; }
    if (line.startsWith("# ")) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(line.slice(2))] }));
    } else if (line.startsWith("## ")) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(line.slice(3))] }));
    } else if (line.startsWith("### ")) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(line.slice(4))] }));
    } else if (/^\s*- /.test(line)) {
      children.push(new Paragraph({ text: line.replace(/^\s*- /, "• ") }));
    } else if (/^\s*> /.test(line)) {
      children.push(new Paragraph({ children: [new TextRun({ text: line.replace(/^\s*> /, ""), italics: true })] }));
    } else {
      const runs: TextRun[] = [];
      const bold = /\*\*([^*]+)\*\*/g;
      let cursor = 0;
      let m: RegExpExecArray | null;
      while ((m = bold.exec(line)) !== null) {
        if (m.index > cursor) runs.push(new TextRun(line.slice(cursor, m.index)));
        runs.push(new TextRun({ text: m[1], bold: true }));
        cursor = m.index + m[0].length;
      }
      if (cursor < line.length) runs.push(new TextRun(line.slice(cursor)));
      children.push(new Paragraph({ children: runs.length > 0 ? runs : [new TextRun(line)] }));
    }
  }
  return new Document({ sections: [{ properties: {}, children }] });
}

export async function exportDraft(doc: ExportableDraft, opts: { format: ExportFormat; filename?: string }): Promise<void> {
  const base = slugify(opts.filename || doc.title);
  if (opts.format === "html") {
    const html = doc.html || "";
    saveAs(new Blob([html], { type: "text/html;charset=utf-8" }), base + ".html");
    return;
  }
  if (opts.format === "txt") {
    const txt = doc.plain || (doc.html ? stripHtml(doc.html) : (doc.markdown || ""));
    saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), base + ".txt");
    return;
  }
  if (opts.format === "md") {
    const md = doc.markdown || (doc.html ? htmlToMarkdown(doc.html) : (doc.plain || ""));
    saveAs(new Blob([md], { type: "text/markdown;charset=utf-8" }), base + ".md");
    return;
  }
  if (opts.format === "docx") {
    const md = doc.markdown || (doc.html ? htmlToMarkdown(doc.html) : (doc.plain || ""));
    const docxDoc = buildDocxFromMarkdown(doc.title, md);
    const blob = await Packer.toBlob(docxDoc);
    saveAs(blob, base + ".docx");
    return;
  }
}

export async function copyAsRichText(html: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    const blob = new Blob([html], { type: "text/html" });
    const text = new Blob([stripHtml(html)], { type: "text/plain" });
    // ClipboardItem is widely supported on modern browsers.
    const item = new ClipboardItem({ "text/html": blob, "text/plain": text });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(stripHtml(html));
      return true;
    } catch {
      return false;
    }
  }
}

export async function downloadZip(files: { name: string; content: string; type?: string }[], filename: string): Promise<void> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, f.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, slugify(filename) + ".zip");
}

export { stripHtml, htmlToMarkdown };
