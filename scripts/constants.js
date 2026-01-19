export const MODULE_ID = "alioths-quickdraw-bar";
export const MODULE_NAME_CN = "AQB";
export const DASHBOARD_APP_ID = "aqb-dashboard";

export const SETTINGS = {
  LAST_TOKEN_UUID: "lastTokenUuid",
  SPELLS_SORT_MODE: "spellsSortMode",
  SPELLS_UNPREPARED_MODE: "spellsUnpreparedMode",
  CONFIG_MENU: "configMenu"
};

export const TABS = [
  { key: "items", label: "所持物" },
  { key: "features", label: "特性" },
  { key: "spells", label: "法术" },
  { key: "checks", label: "检定/豁免" },
  { key: "stateMove", label: "状态/移动" },
  { key: "custom", label: "收藏" }
];

export const ABILITIES = [
  { id: "str", label: "力量" },
  { id: "dex", label: "敏捷" },
  { id: "con", label: "体质" },
  { id: "int", label: "智力" },
  { id: "wis", label: "感知" },
  { id: "cha", label: "魅力" }
];

export const SKILL_GROUPS = [
  {
    key: "str",
    label: "力量技能",
    skills: [
      { id: "ath", label: "运动" }
    ]
  },
  {
    key: "dex",
    label: "敏捷技能",
    skills: [
      { id: "acr", label: "特技" },
      { id: "slt", label: "巧手" },
      { id: "ste", label: "隐匿" }
    ]
  },
  {
    key: "int",
    label: "智力技能",
    skills: [
      { id: "arc", label: "奥秘" },
      { id: "his", label: "历史" },
      { id: "inv", label: "调查" },
      { id: "nat", label: "自然" },
      { id: "rel", label: "宗教" }
    ]
  },
  {
    key: "wis",
    label: "感知技能",
    skills: [
      { id: "ani", label: "驯兽" },
      { id: "ins", label: "洞悉" },
      { id: "med", label: "医药" },
      { id: "prc", label: "察觉" },
      { id: "sur", label: "求生" }
    ]
  },
  {
    key: "cha",
    label: "魅力技能",
    skills: [
      { id: "dec", label: "欺瞒" },
      { id: "itm", label: "威吓" },
      { id: "prf", label: "表演" },
      { id: "per", label: "说服" }
    ]
  }
];

// 特性按钮自动隐藏名单（在此填写需要隐藏的特性名称）
// 说明：key 为按钮显示名称（会受重命名影响），value 任意真值即可。
export const FEATURE_AUTO_HIDE_NAME_MAP = new Map([
  ["施法", true],["背包", true],["水袋", true],["铺盖", true],["高档服装", true],["镶钉皮甲", true],["旅行服装", true],
  ["板甲", true],["铲子", true],["盾牌", true],["撬棍", true],["书籍", true],["香水", true],["羊皮纸", true],["长杆", true],
  ["箭矢", true],["镜子", true],["弩矢", true],["胸甲", true],["水晶", true],["权杖", true],["板条甲", true],["口粮", true],
  ["望远镜", true]
]);
