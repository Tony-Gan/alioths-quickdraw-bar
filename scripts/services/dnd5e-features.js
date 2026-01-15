import { getItemName } from "./dnd5e-item-use.js";

export function getActorFeatureItemDocuments(actor) {
  if (!actor) return [];
  const list = (actor.items?.contents ?? actor.items ?? []);
  return list.filter((i) => i && i.type === "feat") ?? [];
}

function formatFeatureUses(item) {
  const uses = item?.system?.uses ?? {};
  const max = Number(uses?.max ?? 0);
  const value = Number(uses?.value ?? 0);
  if (!Number.isFinite(max) || max <= 0) return "";
  const v = Number.isFinite(value) ? value : 0;
  return `${v}`;
}

function normalizeActivationType(item) {
  const t = item?.system?.activation?.type;
  if (t === "action") return "action";
  if (t === "bonus") return "bonus";
  if (t === "reaction") return "reaction";
  return "other";
}

function mapFeatureButton(item) {
  const displayName = getItemName(item) || "";
  return {
    id: item.id,
    name: displayName,
    icon: item.img,
    usesText: formatFeatureUses(item),
    activationType: normalizeActivationType(item)
  };
}

export function groupFeatureButtonsByUseTime(featureButtons) {
  const order = ["action", "bonus", "reaction", "other"];
  const titles = {
    action: "动作",
    bonus: "附赠动作",
    reaction: "反应",
    other: "其他"
  };

  const buckets = new Map(order.map((k) => [k, []]));
  for (const f of (featureButtons ?? [])) {
    const key = order.includes(f?.activationType) ? f.activationType : "other";
    buckets.get(key)?.push(f);
  }

  const sections = [];
  for (const key of order) {
    const list = buckets.get(key) ?? [];
    if (!list.length) continue;
    const items = list
      .slice()
      .sort((a, b) => (a?.name ?? "").localeCompare((b?.name ?? ""), "zh"));
    sections.push({ title: titles[key] ?? "其他", items });
  }
  return sections;
}

export function getActorFeatureButtons(actor) {
  const feats = getActorFeatureItemDocuments(actor);
  return (feats ?? [])
    .slice()
    .sort((a, b) => (getItemName(a) ?? "").localeCompare(getItemName(b) ?? "", "zh"))
    .map(mapFeatureButton);
}