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
  small: 0.88,
  medium: 1,
  broad: 1.14
};

export function avatarMarkup(config = {}, options = {}) {
  const size = options.size || "md";
  const label = options.label ? `<div class="gp-avatar-label">${safeText(options.label)}</div>` : "";

  const skin = SKIN[config.skinTone] || SKIN.warm;
  const hairStyle = `hair-${safeText(config.hairStyle || "short")}`;
  const eyeStyle = `eyes-${safeText(config.eyeStyle || "round")}`;
  const topStyle = `top-${safeText(config.topStyle || "hoodie")}`;
  const bottomStyle = `bottom-${safeText(config.bottomStyle || "joggers")}`;
  const accessory = `acc-${safeText(config.accessory || "none")}`;
  const hat = `hat-${safeText(config.hat || "none")}`;
  const body = `body-${safeText(config.bodyType || "medium")}`;

  return `
    <div class="gp-explorer-avatar gp-explorer-avatar--${size} ${body}" style="--skin:${skin};--hair:${safeText(config.hairColor || "#47362f")};--eyes:${safeText(config.eyeColor || "#8be7ff")};--top:${safeText(config.topColor || "#7d6dff")};--bottom:${safeText(config.bottomColor || "#2a3757")};--scale:${BODY_SCALE[config.bodyType] || 1};">
      <div class="gp-av-head">
        <div class="gp-av-hair ${hairStyle}"></div>
        <div class="gp-av-face ${eyeStyle}">
          <span class="gp-av-eye left"></span>
          <span class="gp-av-eye right"></span>
          <span class="gp-av-mouth"></span>
        </div>
        <div class="gp-av-hat ${hat}"></div>
      </div>
      <div class="gp-av-body ${topStyle}"></div>
      <div class="gp-av-bottom ${bottomStyle}"></div>
      <div class="gp-av-acc ${accessory}"></div>
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
