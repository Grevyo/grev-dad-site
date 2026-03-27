import { safeText } from "./api.js";

const SKIN = {
  fair: "#ffd9bf",
  warm: "#efb389",
  tan: "#cd8e63",
  deep: "#7e4a35",
  olive: "#bda06d",
  fantasy: "#9ac3ff"
};

const BODY_SCALE = {
  small: 0.9,
  medium: 1,
  broad: 1.1
};

const ALLOWED = {
  hairStyle: ["short", "bob", "spike", "mop", "puff", "none"],
  eyeStyle: ["round", "sleepy", "spark", "wide", "cat"],
  topStyle: ["hoodie", "jacket", "tee", "robe", "armor"],
  bottomStyle: ["joggers", "shorts", "cargo", "skirt", "greaves"],
  accessory: ["none", "scarf", "visor", "headphones", "badge"],
  hat: ["none", "beanie", "cap", "hornband", "crown"],
  bodyType: ["small", "medium", "broad"]
};

export function avatarMarkup(config = {}, options = {}) {
  const size = options.size || "md";
  const label = options.label ? `<div class="gp-avatar-label">${safeText(options.label)}</div>` : "";

  const skin = SKIN[config.skinTone] || SKIN.warm;
  const hairStyle = className("hair", config.hairStyle, "short");
  const eyeStyle = className("eyes", config.eyeStyle, "round");
  const topStyle = className("top", config.topStyle, "hoodie");
  const bottomStyle = className("bottom", config.bottomStyle, "joggers");
  const accessory = className("acc", config.accessory, "none");
  const hat = className("hat", config.hat, "none");
  const body = className("body", config.bodyType, "medium");

  return `
    <div class="gp-explorer-avatar gp-explorer-avatar--${size} ${body}" style="--skin:${skin};--hair:${safeText(config.hairColor || "#47362f")};--eyes:${safeText(config.eyeColor || "#8be7ff")};--top:${safeText(config.topColor || "#7d6dff")};--bottom:${safeText(config.bottomColor || "#2a3757")};--scale:${BODY_SCALE[config.bodyType] || 1};">
      <div class="gp-av-shell ${topStyle} ${bottomStyle} ${hairStyle} ${eyeStyle} ${hat} ${accessory}">
        <span class="gp-av-ground-shadow"></span>

        <div class="gp-av-lower">
          <span class="gp-av-hip"></span>
          <span class="gp-av-leg left"></span>
          <span class="gp-av-leg right"></span>
          <span class="gp-av-shoe left"></span>
          <span class="gp-av-shoe right"></span>
        </div>

        <div class="gp-av-torso-wrap">
          <span class="gp-av-arm left"><span class="gp-av-hand"></span></span>
          <span class="gp-av-arm right"><span class="gp-av-hand"></span></span>
          <span class="gp-av-neck"></span>
          <span class="gp-av-torso"></span>
        </div>

        <div class="gp-av-head-wrap">
          <span class="gp-av-hair-back"></span>
          <span class="gp-av-head"></span>
          <div class="gp-av-face">
            <span class="gp-av-brow left"></span>
            <span class="gp-av-brow right"></span>
            <span class="gp-av-eye left"></span>
            <span class="gp-av-eye right"></span>
            <span class="gp-av-mouth"></span>
          </div>
          <span class="gp-av-hair-front"></span>
          <span class="gp-av-hat"></span>
          <span class="gp-av-accessory"></span>
        </div>
      </div>
      ${label}
    </div>
  `;
}

export function mountAvatar(element, config, options = {}) {
  if (!element) return;
  element.innerHTML = avatarMarkup(config, options);
}

export function buildAvatarEditor(mount, options, state) {
  if (!mount) return;
  const colorField = (id, label, value) => `
    <label class="gp-editor-field">
      <span>${label}</span>
      <input type="color" data-avatar-input="${id}" value="${safeText(value || "#ffffff")}" />
    </label>
  `;

  mount.innerHTML = `
    <div class="gp-avatar-editor-grid">
      ${selectField("skinTone", "Skin Tone", options.skinTone, state.skinTone)}
      ${selectField("hairStyle", "Hair Style", options.hairStyle, state.hairStyle)}
      ${colorField("hairColor", "Hair Color", state.hairColor)}
      ${selectField("eyeStyle", "Eye Style", options.eyeStyle, state.eyeStyle)}
      ${colorField("eyeColor", "Eye Color", state.eyeColor)}
      ${selectField("topStyle", "Top", options.topStyle, state.topStyle)}
      ${colorField("topColor", "Top Color", state.topColor)}
      ${selectField("bottomStyle", "Bottoms", options.bottomStyle, state.bottomStyle)}
      ${colorField("bottomColor", "Bottom Color", state.bottomColor)}
      ${selectField("accessory", "Accessory", options.accessory, state.accessory)}
      ${selectField("hat", "Headwear", options.hat, state.hat)}
      ${selectField("bodyType", "Body Type", options.bodyType, state.bodyType)}
    </div>
  `;
}

function selectField(id, label, values = [], selected) {
  return `
    <label class="gp-editor-field">
      <span>${label}</span>
      <select data-avatar-input="${id}">
        ${(values || []).map((value) => `<option value="${safeText(value)}" ${value === selected ? "selected" : ""}>${safeText(value)}</option>`).join("")}
      </select>
    </label>
  `;
}

function className(prefix, value, fallback) {
  const safeValue = String(value || fallback);
  const listKey = `${prefix}Style`;

  if (prefix === "eyes") {
    return `eyes-${ALLOWED.eyeStyle.includes(safeValue) ? safeValue : fallback}`;
  }
  if (prefix === "top") {
    return `top-${ALLOWED.topStyle.includes(safeValue) ? safeValue : fallback}`;
  }
  if (prefix === "bottom") {
    return `bottom-${ALLOWED.bottomStyle.includes(safeValue) ? safeValue : fallback}`;
  }
  if (prefix === "acc") {
    return `acc-${ALLOWED.accessory.includes(safeValue) ? safeValue : fallback}`;
  }
  if (prefix === "hat") {
    return `hat-${ALLOWED.hat.includes(safeValue) ? safeValue : fallback}`;
  }
  if (prefix === "body") {
    return `body-${ALLOWED.bodyType.includes(safeValue) ? safeValue : fallback}`;
  }

  return `${prefix}-${ALLOWED[listKey]?.includes(safeValue) ? safeValue : fallback}`;
}
