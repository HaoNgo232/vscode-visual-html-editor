import * as parse5 from 'parse5';
import type { ElementOffset, SurgicalChange, SurgicalMapResult } from './htmlTypes';

export type { ElementOffset, SurgicalChange, SurgicalMapResult };

/**
 * HTML5-compliant AST parser using parse5 to tag elements with `data-runtime-id`
 * and generate exact character offset mappings for surgical patching.
 */
export function parseAndTagHtml(originalHtml: string): SurgicalMapResult {
  const offsetMap = new Map<string, ElementOffset>();
  if (!originalHtml) {
    return { taggedHtml: '', offsetMap };
  }

  const doc = parse5.parse(originalHtml, { sourceCodeLocationInfo: true });

  // Recursively collect element nodes with valid startTag locations
  function collectElements(node: any, list: any[] = []): any[] {
    if (node?.tagName && node.tagName !== 'script' && node.tagName !== 'style') {
      const loc = node.sourceCodeLocation;
      if (loc?.startTag) {
        list.push(node);
      }
    }
    if (node?.childNodes) {
      for (const child of node.childNodes) {
        collectElements(child, list);
      }
    }
    return list;
  }

  const elements = collectElements(doc);

  // Sort elements by startTag offset ascending
  elements.sort(
    (a, b) => a.sourceCodeLocation.startTag.startOffset - b.sourceCodeLocation.startTag.startOffset
  );

  let taggedHtml = '';
  let lastIndex = 0;

  for (let i = 0; i < elements.length; i++) {
    const node = elements[i];
    const runtimeId = `e${i + 1}`;
    const loc = node.sourceCodeLocation;
    const tagName = String(node.tagName).toLowerCase();

    const startTagOffset = loc.startTag.startOffset;
    const startTagEndOffset = loc.startTag.endOffset;

    const outerStart = loc.startOffset;
    const outerEnd = loc.endOffset;
    const innerStart = loc.startTag.endOffset;
    const innerEnd = loc.endTag ? loc.endTag.startOffset : innerStart;

    const startLine = loc.startLine ?? 1;
    const startCol = Math.max(0, (loc.startCol ?? 1) - 1);
    const endLine = loc.endLine ?? startLine;
    const endCol = Math.max(0, (loc.endCol ?? 1) - 1);

    offsetMap.set(runtimeId, {
      runtimeId,
      tagName,
      outerStart,
      outerEnd,
      innerStart,
      innerEnd,
      startLine,
      startCol,
      endLine,
      endCol
    });

    // Append text leading up to start tag
    taggedHtml += originalHtml.slice(lastIndex, startTagOffset);

    // Inject data-runtime-id right after tag name in opening tag
    const rawStartTag = originalHtml.slice(startTagOffset, startTagEndOffset);
    const tagMatch = /^<([a-zA-Z0-9:-]+)/.exec(rawStartTag);

    if (tagMatch) {
      const tagNameLen = tagMatch[0].length;
      const injectedStartTag = `${rawStartTag.slice(0, tagNameLen)} data-runtime-id="${runtimeId}"${rawStartTag.slice(tagNameLen)}`;
      taggedHtml += injectedStartTag;
    } else {
      taggedHtml += rawStartTag;
    }

    lastIndex = startTagEndOffset;
  }

  // Append remaining HTML content
  taggedHtml += originalHtml.slice(lastIndex);

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
