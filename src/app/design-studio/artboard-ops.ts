export type Artboard = {
  id: string;
  w: number;
  h: number;
  label?: string;
  svg: string;
};

export type Op =
  | { kind: "prose"; text: string }
  | { kind: "write"; id: string; w: number; h: number; label?: string; svg: string }
  | { kind: "delete"; id: string };

const ART_OPEN_RE = /<<<ARTBOARD\s+op="write"\s+id="([^"]+)"\s+w="(\d+)"\s+h="(\d+)"(?:\s+label="([^"]*)")?\s*>>>/;
const DELETE_RE = /<<<DELETE\s+id="([^"]+)"\s*>>>/;
const ART_CLOSE = "<<<END>>>";
const MARKER_HEAD = "<<<";

export class OpStreamParser {
  private buffer = "";
  private inArtboard: { id: string; w: number; h: number; label?: string } | null = null;
  private body = "";

  feed(chunk: string): Op[] {
    this.buffer += chunk;
    const ops: Op[] = [];

    while (true) {
      if (this.inArtboard) {
        const closeIdx = this.buffer.indexOf(ART_CLOSE);
        if (closeIdx === -1) {
          this.body += this.buffer;
          this.buffer = "";
          break;
        }
        this.body += this.buffer.slice(0, closeIdx);
        this.buffer = this.buffer.slice(closeIdx + ART_CLOSE.length);
        ops.push({
          kind: "write",
          id: this.inArtboard.id,
          w: this.inArtboard.w,
          h: this.inArtboard.h,
          label: this.inArtboard.label,
          svg: this.body.trim(),
        });
        this.inArtboard = null;
        this.body = "";
        continue;
      }

      const headIdx = this.buffer.indexOf(MARKER_HEAD);
      if (headIdx === -1) {
        if (this.buffer) {
          ops.push({ kind: "prose", text: this.buffer });
          this.buffer = "";
        }
        break;
      }

      if (headIdx > 0) {
        ops.push({ kind: "prose", text: this.buffer.slice(0, headIdx) });
        this.buffer = this.buffer.slice(headIdx);
      }

      const closeMarker = this.buffer.indexOf(">>>");
      if (closeMarker === -1) {
        // Partial marker; wait for more input.
        break;
      }

      const marker = this.buffer.slice(0, closeMarker + 3);

      const artMatch = marker.match(ART_OPEN_RE);
      if (artMatch) {
        this.inArtboard = {
          id: artMatch[1],
          w: parseInt(artMatch[2], 10),
          h: parseInt(artMatch[3], 10),
          label: artMatch[4],
        };
        this.buffer = this.buffer.slice(marker.length);
        continue;
      }

      const delMatch = marker.match(DELETE_RE);
      if (delMatch) {
        ops.push({ kind: "delete", id: delMatch[1] });
        this.buffer = this.buffer.slice(marker.length);
        continue;
      }

      // Unknown marker — treat the leading "<<<" as prose so we don't get stuck.
      ops.push({ kind: "prose", text: this.buffer.slice(0, 3) });
      this.buffer = this.buffer.slice(3);
    }

    return ops;
  }

  flush(): Op[] {
    const ops: Op[] = [];
    if (this.inArtboard) {
      ops.push({
        kind: "write",
        id: this.inArtboard.id,
        w: this.inArtboard.w,
        h: this.inArtboard.h,
        label: this.inArtboard.label,
        svg: (this.body + this.buffer).trim(),
      });
      this.inArtboard = null;
      this.body = "";
      this.buffer = "";
    } else if (this.buffer) {
      ops.push({ kind: "prose", text: this.buffer });
      this.buffer = "";
    }
    return ops;
  }
}

export function applyOps(current: Artboard[], ops: Op[]): Artboard[] {
  let next = current;
  let cloned = false;
  const ensureClone = () => {
    if (!cloned) {
      next = current.slice();
      cloned = true;
    }
  };

  for (const op of ops) {
    if (op.kind === "write") {
      ensureClone();
      const idx = next.findIndex((a) => a.id === op.id);
      const board: Artboard = { id: op.id, w: op.w, h: op.h, label: op.label, svg: op.svg };
      if (idx === -1) next.push(board);
      else next[idx] = board;
    } else if (op.kind === "delete") {
      ensureClone();
      next = next.filter((a) => a.id !== op.id);
      cloned = true;
    }
  }

  return next;
}
