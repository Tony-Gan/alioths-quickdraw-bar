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
  return `${v}/${max}`;
}

function isPassiveFeature(item) {
  const t = item?.system?.activation?.type;
  return !t || t === "none" || t === "passive";
}

function mapFeatureButton(item) {
  const displayName = getItemName(item) || "";
  return {
    id: item.id,
    name: displayName,
    icon: item.img,
    usesText: formatFeatureUses(item),
    isPassive: isPassiveFeature(item)
  };
}


export function getActorFeatureButtons(actor) {
  const feats = getActorFeatureItemDocuments(actor);
  return (feats ?? [])
    .slice()
    .sort((a, b) => (getItemName(a) ?? "").localeCompare(getItemName(b) ?? "", "zh"))
    .map(mapFeatureButton);
}
