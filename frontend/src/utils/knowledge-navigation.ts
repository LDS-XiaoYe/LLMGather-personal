export const knowledgeTabs = [
  "documents",
  "retrieval",
  "applications",
  "settings",
] as const;
export type KnowledgeTab = (typeof knowledgeTabs)[number];
export function isKnowledgeHash(hash: string): boolean {
  return /^#\/(?:rag|knowledge)(?:\/|$|\?)/.test(hash);
}
export function readKnowledgeRoute(hash: string): {
  id: string;
  tab: KnowledgeTab;
  library: boolean;
} {
  const path = hash.split("?")[0].split("/").slice(2);
  let id = "";
  try {
    id = decodeURIComponent(path[0] || "");
  } catch {
    /* Invalid deep link is shown as unavailable. */
  }
  return {
    id: id === "library" ? "" : id,
    library: id === "library",
    tab: knowledgeTabs.includes(path[1] as KnowledgeTab)
      ? (path[1] as KnowledgeTab)
      : "documents",
  };
}
export function knowledgeHash(
  id = "",
  tab: KnowledgeTab = "documents",
): string {
  return id ? `#/knowledge/${encodeURIComponent(id)}/${tab}` : "#/knowledge";
}
export function documentStage(doc: {
  parseStatus: string;
  vectorStatus: string;
  failureReason?: string;
}): string {
  if (doc.parseStatus === "failed" || doc.vectorStatus === "failed")
    return "处理失败";
  if (doc.parseStatus === "processing" || doc.parseStatus === "running")
    return "解析中";
  if (doc.parseStatus !== "succeeded") return "等待处理";
  if (doc.vectorStatus === "succeeded") return "已就绪";
  if (["building", "processing", "running"].includes(doc.vectorStatus))
    return "索引中";
  return "等待索引";
}
/** Change only this knowledge base; retain every other association from the fresh server record. */
export function knowledgeAssociation(
  ids: string[],
  kbId: string,
  selected: boolean,
): string[] {
  return selected
    ? [...new Set([...ids, kbId])]
    : ids.filter((id) => id !== kbId);
}
export function validateKnowledgeFile(file: {
  name: string;
  size: number;
}): string {
  if (!/\.(txt|md|csv|json|pdf|docx?|xlsx?)$/i.test(file.name))
    return "支持 TXT、Markdown、CSV、JSON、PDF、Word 和 Excel 文件。";
  if (!file.size) return "文件为空，请选择其他文件。";
  // A conservative client limit keeps base64 requests below the server JSON body limit.
  if (file.size > 1024 * 1024) return "单个文件请控制在 1 MB 以内。";
  return "";
}
