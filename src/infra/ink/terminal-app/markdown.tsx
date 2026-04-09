import React, { Fragment } from "react";
import { Box, Text } from "ink";
import { theme } from "./types.ts";

export function MarkdownBlock({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push(
        <Box key={`space-${index}`} height={1}>
          <Text> </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (
        index < lines.length &&
        !(lines[index] ?? "").trim().startsWith("```")
      ) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      if (index < lines.length) index += 1;

      blocks.push(
        <CodeBlock
          key={`code-${blocks.length}`}
          language={language}
          code={stripSharedIndent(codeLines).join("\n")}
        />,
      );
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)?.[0].length ?? 1;
      const text = trimmed.replace(/^#{1,6}\s/, "");

      blocks.push(
        <Box key={`heading-${blocks.length}`}>
          <Text color={level <= 2 ? theme.brand : theme.text} bold>
            {text}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const [, marker, text] = trimmed.match(/^(\d+\.)\s(.*)$/) ?? [];
      blocks.push(
        <Box key={`number-${blocks.length}`}>
          <Text color={theme.muted}>{marker} </Text>
          <Text color={theme.text}>
            {renderInline(text ?? "", `n-${blocks.length}`)}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, "");
      blocks.push(
        <Box key={`bullet-${blocks.length}`}>
          <Text color={theme.muted}>• </Text>
          <Text color={theme.text}>
            {renderInline(text, `b-${blocks.length}`)}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (/^>\s/.test(trimmed)) {
      const text = trimmed.replace(/^>\s/, "");
      blocks.push(
        <Box key={`quote-${blocks.length}`}>
          <Text color={theme.muted}>│ </Text>
          <Text color={theme.muted} italic>
            {renderInline(text, `q-${blocks.length}`)}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    if (/^_(.+)_\.?$/.test(trimmed)) {
      const text = trimmed.replace(/^_/, "").replace(/_\.?$/, "");
      blocks.push(
        <Box key={`italic-${blocks.length}`}>
          <Text color={theme.muted} italic>
            {text}
          </Text>
        </Box>,
      );
      index += 1;
      continue;
    }

    const paragraph: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = (lines[index] ?? "").trim();
      if (!next || isMarkdownBoundary(next)) break;
      paragraph.push(next);
      index += 1;
    }

    blocks.push(
      <Box key={`paragraph-${blocks.length}`}>
        <Text color={theme.text}>
          {renderInline(paragraph.join(" "), `p-${blocks.length}`)}
        </Text>
      </Box>,
    );
  }

  return <Box flexDirection="column">{blocks}</Box>;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <Box flexDirection="column" marginY={0}>
      {language ? <Text color={theme.subtle}>{language}</Text> : null}
      {code.split("\n").map((line, index) => (
        <Box key={`code-line-${index}`}>
          <Text color={theme.subtle}>│ </Text>
          <Text color={theme.code}>{line}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];

  for (let index = 0; index < text.length; ) {
    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end !== -1) {
        parts.push(
          <Text key={`${keyPrefix}-bold-${index}`} bold>
            {renderInline(text.slice(index + 2, end), `${keyPrefix}-b-${index}`)}
          </Text>,
        );
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith("`", index)) {
      const end = text.indexOf("`", index + 1);
      if (end !== -1) {
        parts.push(
          <Text key={`${keyPrefix}-code-${index}`} color={theme.code}>
            {text.slice(index + 1, end)}
          </Text>,
        );
        index = end + 1;
        continue;
      }
    }

    if (text.startsWith("*", index)) {
      const end = text.indexOf("*", index + 1);
      if (end !== -1) {
        parts.push(
          <Text key={`${keyPrefix}-italic-${index}`} italic>
            {renderInline(text.slice(index + 1, end), `${keyPrefix}-i-${index}`)}
          </Text>,
        );
        index = end + 1;
        continue;
      }
    }

    const next = nextMarkerIndex(text, index + 1);
    const chunkEnd = next === -1 ? text.length : next;
    parts.push(
      <Fragment key={`${keyPrefix}-text-${index}`}>
        {text.slice(index, chunkEnd)}
      </Fragment>,
    );
    index = chunkEnd;
  }

  return parts;
}

function nextMarkerIndex(text: string, start: number): number {
  const candidates = [
    text.indexOf("**", start),
    text.indexOf("`", start),
    text.indexOf("*", start),
  ].filter((value) => value !== -1);

  return candidates.length === 0 ? -1 : Math.min(...candidates);
}

function isMarkdownBoundary(line: string): boolean {
  return (
    line.startsWith("```") ||
    /^#{1,6}\s/.test(line) ||
    /^\d+\.\s/.test(line) ||
    /^[-*]\s/.test(line) ||
    /^>\s/.test(line)
  );
}

function stripSharedIndent(lines: string[]): string[] {
  const contentLines = lines.filter((line) => line.trim().length > 0);
  const minIndent = contentLines.reduce((current, line) => {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    return Math.min(current, indent);
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(minIndent)) return lines;
  return lines.map((line) => line.slice(minIndent));
}
