import type { Metamodel, MetamodelReference } from "@/types/api";

/** 四类元模型 → GB/T 7714 文献类型代码（MEC/DAT/ALG/KRL） */
export function metaTypeCode(modelType: string): string {
  const map: Record<string, string> = {
    MECHANISM: "MEC",
    DATA_MODEL: "DAT",
    ALGORITHM: "ALG",
    KNOWLEDGE_RULE: "KRL",
  };
  return map[modelType] || "GEN";
}

function yearOf(m: Metamodel): string {
  return (m.createdAt || "").slice(0, 4) || "2026";
}

function orgOf(m: Metamodel): string {
  return m.provider || m.sourceOwnership || "元模型学术检索中心";
}

/** 模型级引用（GB/T 7714 计算程序 [CP/OL] 电子资源式著录） */
export function gbtCitation(m: Metamodel): string {
  return `${m.metaCode}. ${m.name}[${metaTypeCode(m.modelType)}/OL]. ${orgOf(m)}, ${yearOf(m)}.`;
}

/** 模型级 BibTeX */
export function bibtexCitation(m: Metamodel): string {
  const key = m.metaCode.replace(/[^A-Za-z0-9-]/g, "");
  return [
    `@misc{${key},`,
    `  author = {{${orgOf(m)}}},`,
    `  title = {${m.name}},`,
    `  year = {${yearOf(m)}},`,
    `  howpublished = {元模型学术检索中心},`,
    `  note = {${m.metaCode} v${m.versionNo}}`,
    `}`,
  ].join("\n");
}

/** 单条参考文献 → GB/T 7714 著录（作者姓前名后大写；类型按出处推断 J/M/R/S/Z） */
export function formatRefGB(ref: MetamodelReference): string {
  const authors = (ref.authors || "")
    .split(/[,，;；]/)
    .map((a) => gbtAuthor(a))
    .filter(Boolean)
    .join(", ");
  const venue = (ref.venue || "").trim();
  const typeCode = /\bGB[ /]?T|\bGB\b/.test(venue)
    ? "S"
    : /报告/.test(venue)
      ? "R"
      : /档案|平台/.test(venue)
        ? "Z"
        : /(Publishing|Press|University|Kluwer|Springer|Wiley|McGraw|Prentice|Cambridge|Nob Hill|Hill)/i.test(venue)
          ? "M"
          : "J";
  const parts = [
    authors ? `${authors}. ` : "",
    (ref.title || "").trim(),
    `[${typeCode}]`,
    venue ? `. ${venue}` : "",
    ref.year ? `, ${ref.year}` : "",
    ".",
    ref.doi ? ` DOI: ${ref.doi}.` : "",
  ];
  return parts.join("");
}

/** 单条参考文献 → BibTeX 条目 */
export function refBibtex(ref: MetamodelReference, key: string): string {
  const type = /\bGB[ /]?T/.test(ref.venue || "")
    ? "misc"
    : /(Publishing|Press|University|Kluwer|Springer|Wiley|McGraw|Prentice|Cambridge|Nob Hill|Hill)/i.test(ref.venue || "")
      ? "book"
      : /报告/.test(ref.venue || "")
        ? "techreport"
        : "article";
  const lines = [
    `@${type}{${key},`,
    `  author = {${ref.authors}},`,
    `  title = {${ref.title}},`,
    ref.venue ? `  ${type === "article" ? "journal" : type === "book" ? "publisher" : "institution"} = {${ref.venue}},` : "",
    ref.year ? `  year = {${ref.year}},` : "",
    ref.doi ? `  doi = {${ref.doi}},` : "",
    `}`,
  ].filter(Boolean);
  return lines.join("\n");
}

/** 全部参考文献合并为一份可下载的 BibTeX */
export function referencesBibtex(m: Metamodel): string {
  const refs = m.references || [];
  return refs
    .map((r, i) => refBibtex(r, `${m.metaCode.replace(/[^A-Za-z0-9-]/g, "")}_ref${i + 1}`))
    .join("\n\n");
}

/** 著者转 GB/T 7714 风格：西文「名. 姓」→「姓 名缩写」全大写；中文原样 */
function gbtAuthor(a: string): string {
  const t = a.trim();
  if (!t) return "";
  if (/[\u4e00-\u9fff]/.test(t)) return t;
  if (/^et al\.?$/i.test(t)) return "et al";
  const m = t.match(/^((?:[A-Z]\.\s*)+)\s*(.+)$/);
  if (m) return `${m[2].toUpperCase()} ${m[1].trim()}`;
  return t.toUpperCase();
}
