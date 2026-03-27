import { safeText } from "./api.js";

export const TYPE_COLORS = {
  Ember: "#ff9052",
  Moss: "#78d37a",
  Zap: "#ffe55f",
  Tidal: "#64d5ff",
  Toxic: "#be79ff",
  Stone: "#c2a580",
  Frost: "#9ce7ff",
  Spirit: "#c29dff",
  Iron: "#c6d2e3",
  Lunar: "#8c8cff",
  Glitch: "#ff69bb",
  Feral: "#ffb870"
};

function drawBody(ctx, traits, w, h) {
  const cx = w / 2;
  const cy = h / 2 + 10;
  const width = 72 * (traits.widthScale || 1);
  const height = 58 * (traits.heightScale || 1);

  ctx.fillStyle = traits.colorPalette?.base || "#67c8ff";
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;

  if (traits.bodyShape === "ferret") {
    ctx.beginPath();
    ctx.ellipse(cx, cy, width * 0.85, height * 0.58, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (traits.bodyShape === "drake") {
    ctx.beginPath();
    ctx.moveTo(cx - width * 0.6, cy + height * 0.2);
    ctx.quadraticCurveTo(cx - width * 0.7, cy - height * 0.5, cx, cy - height * 0.55);
    ctx.quadraticCurveTo(cx + width * 0.7, cy - height * 0.4, cx + width * 0.6, cy + height * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.roundRect(cx - width / 2, cy - height / 2, width, height, 26);
    ctx.fill();
    ctx.stroke();
  }

  if (traits.patternType && traits.patternType !== "plain") {
    ctx.fillStyle = traits.colorPalette?.secondary || "#4573e4";
    for (let i = 0; i < 4; i += 1) {
      const px = cx - width * 0.3 + i * (width / 4);
      const py = cy - height * 0.18 + ((i % 2) ? 9 : -6);
      if (traits.patternType === "stripes") {
        ctx.fillRect(px, cy - height * 0.3, 8, height * 0.58);
      } else {
        ctx.beginPath();
        ctx.ellipse(px, py, 7 + (i % 3), 5 + ((i + 1) % 3), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawFace(ctx, traits, w, h) {
  const cx = w / 2;
  const cy = h / 2 + 2;
  const eyeGap = traits.eyeType === "wide" ? 18 : 12;

  ctx.fillStyle = "#0f1120";
  ctx.beginPath();
  ctx.ellipse(cx - eyeGap, cy, 5, traits.eyeType === "sleepy" ? 2.5 : 4.5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + eyeGap, cy, 5, traits.eyeType === "sleepy" ? 2.5 : 4.5, 0, 0, Math.PI * 2);
  if (traits.eyeType === "cyclops") {
    ctx.ellipse(cx, cy, 7, 6, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.strokeStyle = "#0f1120";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (traits.mouthType === "fang") {
    ctx.moveTo(cx - 8, cy + 18);
    ctx.lineTo(cx + 8, cy + 18);
    ctx.moveTo(cx - 2, cy + 18);
    ctx.lineTo(cx - 2, cy + 24);
    ctx.moveTo(cx + 2, cy + 18);
    ctx.lineTo(cx + 2, cy + 24);
  } else if (traits.mouthType === "flat") {
    ctx.moveTo(cx - 8, cy + 18);
    ctx.lineTo(cx + 8, cy + 18);
  } else {
    ctx.arc(cx, cy + 16, 8, 0, Math.PI);
  }
  ctx.stroke();
}

function drawAccessories(ctx, traits, w, h) {
  const cx = w / 2;
  const cy = h / 2 + 8;

  if (traits.earType === "satellite") {
    ctx.fillStyle = traits.colorPalette?.secondary || "#1d3573";
    ctx.beginPath();
    ctx.ellipse(cx - 22, cy - 34, 8, 13, -0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + 22, cy - 34, 8, 13, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (traits.extra === "horn") {
    ctx.fillStyle = traits.colorPalette?.accent || "#ffcc66";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 44);
    ctx.lineTo(cx - 8, cy - 20);
    ctx.lineTo(cx + 8, cy - 20);
    ctx.closePath();
    ctx.fill();
  }

  if (traits.extra === "wings") {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.ellipse(cx - 34, cy - 4, 14, 23, -0.6, 0, Math.PI * 2);
    ctx.ellipse(cx + 34, cy - 4, 14, 23, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (traits.accessory === "scarf" || traits.accessory === "bandana") {
    ctx.fillStyle = traits.colorPalette?.accent || "#ff8dc6";
    ctx.fillRect(cx - 20, cy + 14, 40, 8);
  }
}

export function renderPet(canvas, traits, opts = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const bob = opts.bob || 0;

  ctx.clearRect(0, 0, width, height);

  if (opts.primaryType) {
    const glow = TYPE_COLORS[opts.primaryType] || traits?.colorPalette?.accent || "#6ae2ff";
    ctx.fillStyle = `${glow}22`;
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2 + 14, width * 0.44, height * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(0, Math.sin(bob * ((traits?.bobSpeed || 1))) * 3);

  drawBody(ctx, traits || {}, width, height);
  drawAccessories(ctx, traits || {}, width, height);
  drawFace(ctx, traits || {}, width, height);

  ctx.restore();

  if (opts.rarityColor) {
    ctx.strokeStyle = opts.rarityColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, width - 6, height - 6);
  }
}

export function rarityClass(rarity) {
  return `rarity-${String(rarity || "common").toLowerCase()}`;
}

export function typeBadge(type) {
  const t = safeText(type || "Feral");
  return `<span class="gp-type-badge" style="--type:${TYPE_COLORS[t] || "#8baadf"}">${t}</span>`;
}

export function typeBadgePair(primary, secondary) {
  return `${typeBadge(primary)}${secondary ? typeBadge(secondary) : ""}`;
}
