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
