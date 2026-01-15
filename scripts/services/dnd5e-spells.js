import { getItemName } from "./dnd5e-item-use.js";

const LEVEL_TITLES = [
  "戏法",
  "一环",
  "二环",
  "三环",
  "四环",
  "五环",
  "六环",
  "七环",
  "八环",
  "九环"
];

function buildSlotSquares(value, max) {
  const m = Math.max(0, Number(max ?? 0));
  if (m <= 0) return "";
  const v = Math.max(0, Math.min(Number(value ?? 0), m));
  return "■".repeat(v) + "□".repeat(Math.max(0, m - v));
}

function buildSlotSpan(squares, cls) {
  if (!squares) return "";
  return `<span class="${cls}">${squares}</span>`;
}

export function getSpellSlotsSummary(actor) {
  if (!actor) return "法术位：—";
  const spells = actor.system?.spells ?? {};

  const parts = [];
  for (let lvl = 1; lvl <= 9; lvl += 1) {
    const s = spells[`spell${lvl}`];
    const max = Number(s?.max ?? 0);
    const value = Number(s?.value ?? 0);
    if (max > 0) parts.push(`${lvl}环：${value}/${max}`);
  }

  const pact = spells.pact;
  const pactMax = Number(pact?.max ?? 0);
  const pactValue = Number(pact?.value ?? 0);
  if (pactMax > 0) parts.push(`契约：${pactValue}/${pactMax}`);

  if (!parts.length) return "法术位：无";
  return parts.join(" | ");
}

export function getActorSpellItems(actor) {
  if (!actor) return [];
  return actor.items?.filter((i) => i?.type === "spell") ?? [];
}

export function getSpellPreparationState(spell) {
  const prep = spell?.system?.preparation ?? {};
  const mode = prep?.mode ?? "prepared";
  const prepared = Boolean(prep?.prepared);

  if (["always", "atwill", "innate", "pact", "ritual"].includes(mode)) return "always";
  if (mode === "prepared") return prepared ? "prepared" : "unprepared";

  return "prepared";
}

export function getSpellPreparationIcon(state) {
  switch (state) {
    case "always":
      return { icon: "fa-solid fa-check", title: "始终准备" };
    case "prepared":
      return { icon: "fa-solid fa-check", title: "已准备" };
    case "unprepared":
    default:
      return { icon: "fa-solid fa-xmark", title: "未准备" };
  }
}

export function groupSpellsByLevel(spells, actor) {
  const buckets = new Map();
  for (const s of spells) {
    const lvl = Number(s?.system?.level ?? 0);
    if (!buckets.has(lvl)) buckets.set(lvl, []);
    buckets.get(lvl).push(s);
  }

  const levels = [...buckets.keys()].sort((a, b) => a - b);
  const sections = [];
  const spellData = actor?.system?.spells ?? {};
  const pact = spellData?.pact;
  const pactMax = Number(pact?.max ?? 0);
  const pactValue = Number(pact?.value ?? 0);

  for (const lvl of levels) {
    const list = buckets.get(lvl) ?? [];
    if (!list.length) continue;
    let title = LEVEL_TITLES[lvl] ?? `${lvl}环`;

    if (lvl > 0) {
      const parts = [];

      const normal = spellData?.[`spell${lvl}`];
      const normalMax = Number(normal?.max ?? 0);
      const normalValue = Number(normal?.value ?? 0);
      if (normalMax > 0) {
        const squares = buildSlotSquares(normalValue, normalMax);
        parts.push(buildSlotSpan(squares, "aqb-spell-slot-normal"));
      }

      if (pactMax > 0) {
        const squares = buildSlotSquares(pactValue, pactMax);
        parts.push(buildSlotSpan(squares, "aqb-spell-slot-pact"));
      }

      if (parts.length) title = `${title} | ${parts.join(" | ")}`;
    }
    
    const spellsMapped = list
      .slice()
      .sort((a, b) => (getItemName(a) ?? "").localeCompare(getItemName(b) ?? "", "zh"))
      .map((spell) => {
        const state = getSpellPreparationState(spell);
        const { icon, title: prepTitle } = getSpellPreparationIcon(state);
        const fullName = getItemName(spell) || "";

        return {
          id: spell.id,
          name: fullName,
          icon: spell.img,
          prepIcon: icon,
          prepTitle,
          prepState: state
        };
      });

    sections.push({ key: `level:${lvl}`, title, spells: spellsMapped });
  }
  return sections;
}

function normalizeActivationType(spell) {
  const t = spell?.system?.activation?.type;
  if (t === "action") return "action";
  if (t === "bonus") return "bonus";
  if (t === "reaction") return "reaction";
  return "other";
}

export function groupSpellsByCastingTime(spells) {
  const order = ["action", "bonus", "reaction", "other"];
  const titles = {
    action: "动作",
    bonus: "附赠动作",
    reaction: "反应",
    other: "其他"
  };

  const buckets = new Map(order.map((k) => [k, []]));
  for (const s of spells) {
    const key = normalizeActivationType(s);
    buckets.get(key)?.push(s);
  }

  const sections = [];
  for (const key of order) {
    const list = buckets.get(key) ?? [];
    if (!list.length) continue;
    
    const spellsMapped = list
      .slice()
      .sort((a, b) => (getItemName(a) ?? "").localeCompare(getItemName(b) ?? "", "zh"))
      .map((spell) => {
        const state = getSpellPreparationState(spell);
        const { icon, title: prepTitle } = getSpellPreparationIcon(state);
        const fullName = getItemName(spell) || "";

        return {
          id: spell.id,
          name: fullName,
          icon: spell.img,
          prepIcon: icon,
          prepTitle,
          prepState: state
        };
      });

    sections.push({ key: `time:${key}`, title: titles[key] ?? "其他", spells: spellsMapped });
  }
  return sections;
}
