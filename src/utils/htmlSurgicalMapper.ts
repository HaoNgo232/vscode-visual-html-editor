/**
 * HTML Surgical Mapper Utility
 * Injects temporary `data-runtime-id` attributes for webview rendering
 * and maps element character offsets in the clean original HTML source.
 */

export interface ElementOffset {
  runtimeId: string;
  tagName: string;
  outerStart: number;
  outerEnd: number;
  innerStart: number;
  innerEnd: number;
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
}

/**
 * Parses original HTML, injects `data-runtime-id` for webview runtime,
 * and records character ranges of elements in originalHtml.
 */
export function parseAndTagHtml(originalHtml: string): SurgicalMapResult {
  const offsetMap = new Map<string, ElementOffset>();
  let taggedHtml = '';
  let lastIndex = 0;
  let elementCounter = 0;

  const stack: StackItem[] = [];

  // Regex to match comments, script/style blocks, or HTML tags
  const tokenRegex =
    /<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<(?:\/([a-zA-Z0-9-]+)|([a-zA-Z0-9-]+)([^>]*?))>/gi;

  let match: RegExpExecArray | null = tokenRegex.exec(originalHtml);

  while (match !== null) {
    const matchStart = match.index;
    const fullMatch = match[0];

    // Append preceding raw text to taggedHtml
    taggedHtml += originalHtml.substring(lastIndex, matchStart);

    const isClosing = !!match[1];
    const isOpening = !!match[2];

    if (isOpening) {
      const tagName = match[2].toLowerCase();
      const rawAttrs = match[3] || '';
      const isSelfClosing = rawAttrs.trim().endsWith('/') || VOID_TAGS.has(tagName);

      elementCounter++;
      const runtimeId = `e${elementCounter}`;

      // Insert data-runtime-id into opening tag
      const cleanAttrs = rawAttrs.endsWith('/') ? rawAttrs.slice(0, -1) : rawAttrs;
      const injectedTag = `<${match[2]} data-runtime-id="${runtimeId}"${cleanAttrs}${rawAttrs.endsWith('/') ? '/' : ''}>`;

      taggedHtml += injectedTag;

      const outerStart = matchStart;
      const innerStart = matchStart + fullMatch.length;

      if (isSelfClosing) {
        offsetMap.set(runtimeId, {
          runtimeId,
          tagName,
          outerStart,
          outerEnd: innerStart,
          innerStart,
          innerEnd: innerStart
        });
      } else {
        stack.push({
          runtimeId,
          tagName,
          outerStart,
          innerStart
        });
      }
    } else if (isClosing) {
      const tagName = match[1].toLowerCase();
      taggedHtml += fullMatch;

      const innerEnd = matchStart;
      const outerEnd = matchStart + fullMatch.length;

      // Find matching opening tag on stack (popping from top)
      let stackIndex = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagName === tagName) {
          stackIndex = i;
          break;
        }
      }

      if (stackIndex !== -1) {
        const item = stack[stackIndex];
        // Remove popped item and any orphaned unclosed tags above it
        stack.splice(stackIndex, stack.length - stackIndex);

        offsetMap.set(item.runtimeId, {
          runtimeId: item.runtimeId,
          tagName: item.tagName,
          outerStart: item.outerStart,
          outerEnd,
          innerStart: item.innerStart,
          innerEnd
        });
      }
    } else {
      // Comment, script, or style block
      taggedHtml += fullMatch;
    }

    lastIndex = matchStart + fullMatch.length;
    match = tokenRegex.exec(originalHtml);
  }

  taggedHtml += originalHtml.substring(lastIndex);

  return {
    taggedHtml,
    offsetMap
  };
}

/**
 * Applies surgical innerHTML patches to originalHtml using the offsetMap.
 * Changes are processed in descending order of innerStart to preserve earlier character offsets.
 */
export function applySurgicalPatches(
  originalHtml: string,
  offsetMap: Map<string, ElementOffset>,
  changes: SurgicalChange[]
): string {
  if (!changes || changes.length === 0) {
    return originalHtml;
  }

  // Filter valid changes with known offsets
  const validChanges: Array<{ change: SurgicalChange; offset: ElementOffset }> = [];

  for (const change of changes) {
    const offset = offsetMap.get(change.runtimeId);
    if (offset) {
      validChanges.push({ change, offset });
    }
  }

  if (validChanges.length === 0) {
    return originalHtml;
  }

  // Sort changes in descending order of innerStart
  validChanges.sort((a, b) => b.offset.innerStart - a.offset.innerStart);

  let updatedHtml = originalHtml;

  for (const { change, offset } of validChanges) {
    const before = updatedHtml.slice(0, offset.innerStart);
    const after = updatedHtml.slice(offset.innerEnd);
    updatedHtml = before + change.newInnerHTML + after;
  }

  return updatedHtml;
}
