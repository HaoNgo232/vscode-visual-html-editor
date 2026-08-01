/**
 * HTML AST & Surgical Mapper Utility
 * AST-level state machine parser for HTML5, template attributes, and multi-line elements.
 * Correctly handles attribute quotes (expressions with < and > inside attribute values),
 * comments, script/style blocks, and exact line/column positions.
 */

export interface ElementOffset {
  runtimeId: string;
  tagName: string;
  outerStart: number;
  outerEnd: number;
  innerStart: number;
  innerEnd: number;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface SurgicalMapResult {
  taggedHtml: string;
  offsetMap: Map<string, ElementOffset>;
}

export interface SurgicalChange {
  runtimeId: string;
  newInnerHTML: string;
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

interface StackItem {
  runtimeId: string;
  tagName: string;
  outerStart: number;
  innerStart: number;
  startLine: number;
  startCol: number;
}

function computeLineCol(text: string, index: number): { line: number; col: number } {
  let line = 1;
  let lastNewlineIndex = -1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      lastNewlineIndex = i;
    }
  }
  const col = index - (lastNewlineIndex + 1);
  return { line, col };
}

/**
 * Parses original HTML using an AST state machine tokenizer, injects `data-runtime-id`
 * for webview runtime, and records precise character ranges & line/column positions in originalHtml.
 */
export function parseAndTagHtml(originalHtml: string): SurgicalMapResult {
  const offsetMap = new Map<string, ElementOffset>();
  let taggedHtml = '';
  let elementCounter = 0;
  const stack: StackItem[] = [];

  let i = 0;
  const len = originalHtml.length;

  while (i < len) {
    // 1. Check for HTML Comment <!-- ... -->
    if (originalHtml.startsWith('<!--', i)) {
      const commentEnd = originalHtml.indexOf('-->', i + 4);
      const end = commentEnd === -1 ? len : commentEnd + 3;
      taggedHtml += originalHtml.substring(i, end);
      i = end;
      continue;
    }

    // 2. Check for <script> ... </script>
    if (originalHtml.substring(i, i + 7).toLowerCase() === '<script') {
      const charAfter = originalHtml[i + 7];
      if (!charAfter || /\s|>|\//.test(charAfter)) {
        const scriptEndMatch = /<\/script\s*>/i.exec(originalHtml.substring(i));
        if (scriptEndMatch) {
          const end = i + scriptEndMatch.index + scriptEndMatch[0].length;
          taggedHtml += originalHtml.substring(i, end);
          i = end;
          continue;
        }
      }
    }

    // 3. Check for <style> ... </style>
    if (originalHtml.substring(i, i + 6).toLowerCase() === '<style') {
      const charAfter = originalHtml[i + 6];
      if (!charAfter || /\s|>|\//.test(charAfter)) {
        const styleEndMatch = /<\/style\s*>/i.exec(originalHtml.substring(i));
        if (styleEndMatch) {
          const end = i + styleEndMatch.index + styleEndMatch[0].length;
          taggedHtml += originalHtml.substring(i, end);
          i = end;
          continue;
        }
      }
    }

    // 4. Check for Tag Opening/Closing: <
    if (originalHtml[i] === '<') {
      const outerStart = i;
      const isClosing = originalHtml[i + 1] === '/';
      const tagStartPos = isClosing ? i + 2 : i + 1;

      // Extract tag name
      let tagEndPos = tagStartPos;
      while (tagEndPos < len && /[a-zA-Z0-9-]/.test(originalHtml[tagEndPos])) {
        tagEndPos++;
      }

      const rawTagName = originalHtml.substring(tagStartPos, tagEndPos);
      if (rawTagName.length > 0) {
        const tagName = rawTagName.toLowerCase();

        // Scan attributes while respecting quotes
        let attrScanPos = tagEndPos;
        let inQuote: string | null = null;

        while (attrScanPos < len) {
          const char = originalHtml[attrScanPos];
          if (inQuote) {
            if (char === inQuote) {
              inQuote = null;
            }
          } else if (char === '"' || char === "'") {
            inQuote = char;
          } else if (char === '>') {
            break;
          }
          attrScanPos++;
        }

        if (attrScanPos < len && originalHtml[attrScanPos] === '>') {
          const outerTagFull = originalHtml.substring(outerStart, attrScanPos + 1);

          if (isClosing) {
            taggedHtml += outerTagFull;
            const innerEnd = outerStart;
            const outerEnd = attrScanPos + 1;

            // Match stack
            let stackIndex = -1;
            for (let s = stack.length - 1; s >= 0; s--) {
              if (stack[s].tagName === tagName) {
                stackIndex = s;
                break;
              }
            }

            if (stackIndex !== -1) {
              const item = stack[stackIndex];
              stack.splice(stackIndex, stack.length - stackIndex);

              const startPos = computeLineCol(originalHtml, item.outerStart);
              const endPos = computeLineCol(originalHtml, outerEnd);

              offsetMap.set(item.runtimeId, {
                runtimeId: item.runtimeId,
                tagName: item.tagName,
                outerStart: item.outerStart,
                outerEnd,
                innerStart: item.innerStart,
                innerEnd,
                startLine: startPos.line,
                startCol: startPos.col,
                endLine: endPos.line,
                endCol: endPos.col
              });
            }
          } else {
            // Opening tag
            const rawAttrs = originalHtml.substring(tagEndPos, attrScanPos);
            const isSelfClosing = rawAttrs.trim().endsWith('/') || VOID_TAGS.has(tagName);

            elementCounter++;
            const runtimeId = `e${elementCounter}`;

            const cleanAttrs = rawAttrs.endsWith('/') ? rawAttrs.slice(0, -1) : rawAttrs;
            const injectedTag = `<${rawTagName} data-runtime-id="${runtimeId}"${cleanAttrs}${rawAttrs.endsWith('/') ? '/' : ''}>`;

            taggedHtml += injectedTag;

            const innerStart = attrScanPos + 1;
            const outerEnd = attrScanPos + 1;
            const startPos = computeLineCol(originalHtml, outerStart);

            if (isSelfClosing) {
              const endPos = computeLineCol(originalHtml, outerEnd);
              offsetMap.set(runtimeId, {
                runtimeId,
                tagName,
                outerStart,
                outerEnd,
                innerStart,
                innerEnd: innerStart,
                startLine: startPos.line,
                startCol: startPos.col,
                endLine: endPos.line,
                endCol: endPos.col
              });
            } else {
              stack.push({
                runtimeId,
                tagName,
                outerStart,
                innerStart,
                startLine: startPos.line,
                startCol: startPos.col
              });
            }
          }

          i = attrScanPos + 1;
          continue;
        }
      }
    }

    // Default: append current character
    taggedHtml += originalHtml[i];
    i++;
  }

  return {
    taggedHtml,
    offsetMap
  };
}

/**
 * Applies AST-based surgical innerHTML patches to originalHtml using offsetMap.
 * Preserves 100% of indentation and surrounding non-edited code.
 */
export function applySurgicalPatches(
  originalHtml: string,
  offsetMap: Map<string, ElementOffset>,
  changes: SurgicalChange[]
): string {
  if (!changes || changes.length === 0) {
    return originalHtml;
  }

  // Filter valid changes with known offsets and verify structural integrity
  const validChanges: Array<{ change: SurgicalChange; offset: ElementOffset }> = [];

  for (const change of changes) {
    const offset = offsetMap.get(change.runtimeId);
    if (!offset) {
      // If any runtimeId is missing or stale, abort surgical patch to trigger fallbackHtml
      return originalHtml;
    }
    // Check if newInnerHTML contains a closing tag matching offset.tagName (indicating element tag split by Enter key)
    const closingTag = `</${offset.tagName.toLowerCase()}>`;
    if (change.newInnerHTML.toLowerCase().includes(closingTag)) {
      // Element tag structure was split. Abort surgical patch to trigger safe full-document fallbackHtml!
      return originalHtml;
    }
    validChanges.push({ change, offset });
  }

  // Filter out any child changes whose range is completely nested inside a parent element change
  const topLevelChanges = validChanges.filter(({ offset: childOffset }) => {
    return !validChanges.some(({ offset: parentOffset }) => {
      if (parentOffset.runtimeId === childOffset.runtimeId) return false;
      return (
        parentOffset.innerStart <= childOffset.innerStart &&
        childOffset.innerEnd <= parentOffset.innerEnd
      );
    });
  });

  // Sort top-level changes in descending order of innerStart
  topLevelChanges.sort((a, b) => b.offset.innerStart - a.offset.innerStart);

  let updatedHtml = originalHtml;

  for (const { change, offset } of topLevelChanges) {
    const before = updatedHtml.slice(0, offset.innerStart);
    const after = updatedHtml.slice(offset.innerEnd);
    updatedHtml = before + change.newInnerHTML + after;
  }

  return updatedHtml;
}
