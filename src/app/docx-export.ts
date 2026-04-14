import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

interface SectionItem {
  label: string;
  content: string;
}

interface Section {
  heading: string;
  items?: SectionItem[];
  text?: string;
}

const AMBER = "F7B041";
const BLUE = "0B86D1";
const BODY_COLOR = "1A1A1A";
const FONT = "Outfit";
const FALLBACK = "Arial";

export async function exportDocx(title: string, sections: Section[]) {
  var children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      border: {
        bottom: { color: AMBER, size: 6, space: 8, style: "single" as const },
      },
      children: [
        new TextRun({
          text: "SemiAnalysis Weekly - " + title,
          bold: true,
          size: 44,
          color: AMBER,
          font: { name: FONT, hint: "default" },
        }),
      ],
    })
  );

  // Spacer after title
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  sections.forEach(function (s) {
    // Section heading (H2 style)
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 160 },
        children: [
          new TextRun({
            text: s.heading,
            bold: true,
            size: 32,
            color: BLUE,
            font: { name: FONT, hint: "default" },
          }),
        ],
      })
    );

    // Items within section
    if (s.items) {
      s.items.forEach(function (it) {
        // Item label (H3 style)
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 240, after: 80 },
            children: [
              new TextRun({
                text: it.label,
                bold: true,
                size: 26,
                color: "333333",
                font: { name: FONT, hint: "default" },
              }),
            ],
          })
        );

        // Item content - split by newlines into separate runs
        var contentText = it.content || "";
        if (contentText) {
          var lines = contentText.split("\n");
          var runs: TextRun[] = [];
          lines.forEach(function (line, idx) {
            if (idx > 0) {
              runs.push(new TextRun({ break: 1, text: "", font: { name: FALLBACK } }));
            }
            runs.push(
              new TextRun({
                text: line,
                size: 22,
                color: BODY_COLOR,
                font: { name: FONT, hint: "default" },
              })
            );
          });
          children.push(
            new Paragraph({
              spacing: { after: 120 },
              children: runs,
            })
          );
        }
      });
    }

    // Plain text section
    if (s.text) {
      var textLines = s.text.split("\n");
      var textRuns: TextRun[] = [];
      textLines.forEach(function (line, idx) {
        if (idx > 0) {
          textRuns.push(new TextRun({ break: 1, text: "", font: { name: FALLBACK } }));
        }
        textRuns.push(
          new TextRun({
            text: line,
            size: 22,
            color: BODY_COLOR,
            font: { name: FONT, hint: "default" },
          })
        );
      });
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: textRuns,
        })
      );
    }
  });

  var doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FALLBACK,
            size: 22,
            color: BODY_COLOR,
          },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  var blob = await Packer.toBlob(doc);
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "SA_Weekly_" + title.replace(/[^a-zA-Z0-9_#]/g, "_") + ".docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
