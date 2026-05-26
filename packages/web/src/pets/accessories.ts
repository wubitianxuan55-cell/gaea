// Pet accessory definitions — procedurally drawn overlays composited on Canvas

export interface AccessoryDef {
  id: string;
  name: string;
  nameCN: string;
  category: 'hat' | 'glasses' | 'scarf' | 'collar' | 'ears' | 'tail';
  /** Draw the accessory on canvas context at given cell dimensions */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, frameIndex: number) => void;
}

function hatPropeller(ctx: CanvasRenderingContext2D, w: number, h: number, _f: number) {
  // Beanie base
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.08, w * 0.18, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w * 0.28, h * 0, w * 0.44, h * 0.08);
  // Propeller
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(w * 0.48, h * 0 - h * 0.04, w * 0.04, h * 0.04);
  const bladeAngle = (_f * 0.6) % (Math.PI * 2);
  ctx.save();
  ctx.translate(w * 0.5, h * 0 - h * 0.04);
  ctx.rotate(bladeAngle);
  ctx.fillStyle = '#3498db';
  ctx.fillRect(-w * 0.12, -h * 0.01, w * 0.24, h * 0.02);
  ctx.restore();
}

function hatCrown(ctx: CanvasRenderingContext2D, w: number, h: number, _f: number) {
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  // Crown base
  ctx.moveTo(w * 0.25, h * 0.1);
  ctx.lineTo(w * 0.75, h * 0.1);
  ctx.lineTo(w * 0.75, h * 0.03);
  ctx.lineTo(w * 0.68, h * 0);
  ctx.lineTo(w * 0.62, h * 0.06);
  ctx.lineTo(w * 0.56, h * 0 - h * 0.04);
  ctx.lineTo(w * 0.5, h * 0.03);
  ctx.lineTo(w * 0.44, h * 0 - h * 0.04);
  ctx.lineTo(w * 0.38, h * 0.06);
  ctx.lineTo(w * 0.32, h * 0);
  ctx.lineTo(w * 0.25, h * 0.03);
  ctx.closePath();
  ctx.fill();
  // Jewels
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.05, w * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.4, h * 0.06, w * 0.015, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.6, h * 0.06, w * 0.015, 0, Math.PI * 2); ctx.fill();
}

function glassesRound(ctx: CanvasRenderingContext2D, w: number, h: number, _f: number) {
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = w * 0.015;
  // Left lens
  ctx.beginPath();
  ctx.arc(w * 0.38, h * 0.22, w * 0.1, 0, Math.PI * 2);
  ctx.stroke();
  // Right lens
  ctx.beginPath();
  ctx.arc(w * 0.62, h * 0.22, w * 0.1, 0, Math.PI * 2);
  ctx.stroke();
  // Bridge
  ctx.beginPath();
  ctx.moveTo(w * 0.48, h * 0.22);
  ctx.lineTo(w * 0.52, h * 0.22);
  ctx.stroke();
  // Lens tint
  ctx.fillStyle = 'rgba(52,152,219,0.1)';
  ctx.beginPath(); ctx.arc(w * 0.38, h * 0.22, w * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.62, h * 0.22, w * 0.09, 0, Math.PI * 2); ctx.fill();
}

function glassesSunglasses(ctx: CanvasRenderingContext2D, w: number, h: number, _f: number) {
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.rect(w * 0.24, h * 0.17, w * 0.22, h * 0.1);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(w * 0.54, h * 0.17, w * 0.22, h * 0.1);
  ctx.fill();
  // Bridge
  ctx.fillStyle = '#333';
  ctx.fillRect(w * 0.46, h * 0.2, w * 0.08, h * 0.03);
  // Reflection
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(w * 0.26, h * 0.18, w * 0.1, h * 0.03);
  ctx.fillRect(w * 0.56, h * 0.18, w * 0.1, h * 0.03);
}

function scarfWarm(ctx: CanvasRenderingContext2D, w: number, h: number, _f: number) {
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.16);
  ctx.lineTo(w * 0.65, h * 0.16);
  ctx.lineTo(w * 0.7, h * 0.22);
  ctx.lineTo(w * 0.3, h * 0.22);
  ctx.closePath();
  ctx.fill();
  // Dangling end
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.2);
  ctx.lineTo(w * 0.38, h * 0.2);
  ctx.lineTo(w * 0.38, h * 0.32);
  ctx.lineTo(w * 0.32, h * 0.3);
  ctx.closePath();
  ctx.fill();
  // Stripe
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(w * 0.32, h * 0.19, w * 0.36, h * 0.02);
}

function collarSpiked(ctx: CanvasRenderingContext2D, w: number, h: number, _f: number) {
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(w * 0.3, h * 0.17, w * 0.4, h * 0.04);
  // Spikes
  ctx.fillStyle = '#95a5a6';
  for (let i = 0; i < 5; i++) {
    const cx = w * (0.32 + i * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.02, h * 0.17);
    ctx.lineTo(cx, h * 0.12);
    ctx.lineTo(cx + w * 0.02, h * 0.17);
    ctx.closePath();
    ctx.fill();
  }
}

function earsBunny(ctx: CanvasRenderingContext2D, w: number, h: number, _f: number) {
  ctx.fillStyle = '#f5c6d0';
  // Left ear
  ctx.beginPath();
  ctx.ellipse(w * 0.34, h * 0.02, w * 0.06, h * 0.12, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb3c1';
  ctx.beginPath();
  ctx.ellipse(w * 0.34, h * 0.03, w * 0.035, h * 0.08, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Right ear
  ctx.fillStyle = '#f5c6d0';
  ctx.beginPath();
  ctx.ellipse(w * 0.66, h * 0.02, w * 0.06, h * 0.12, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb3c1';
  ctx.beginPath();
  ctx.ellipse(w * 0.66, h * 0.03, w * 0.035, h * 0.08, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function earsCat(ctx: CanvasRenderingContext2D, w: number, h: number, _f: number) {
  ctx.fillStyle = '#ff9f43';
  // Left ear
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.08);
  ctx.lineTo(w * 0.4, h * 0.08);
  ctx.lineTo(w * 0.32, h - h * 0.01);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffbe76';
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.08);
  ctx.lineTo(w * 0.37, h * 0.07);
  ctx.lineTo(w * 0.33, h * 0.02);
  ctx.closePath();
  ctx.fill();
  // Right ear
  ctx.fillStyle = '#ff9f43';
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.08);
  ctx.lineTo(w * 0.6, h * 0.08);
  ctx.lineTo(w * 0.68, h - h * 0.01);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffbe76';
  ctx.beginPath();
  ctx.moveTo(w * 0.7, h * 0.08);
  ctx.lineTo(w * 0.63, h * 0.07);
  ctx.lineTo(w * 0.67, h * 0.02);
  ctx.closePath();
  ctx.fill();
}

function tailCat(ctx: CanvasRenderingContext2D, w: number, h: number, _f: number) {
  const sway = Math.sin(_f * 0.3) * w * 0.03;
  ctx.strokeStyle = '#ff9f43';
  ctx.lineWidth = w * 0.04;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.82, h * 0.7);
  ctx.quadraticCurveTo(w * 0.95 + sway, h * 0.55, w * 0.9 + sway, h * 0.4);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w * 0.9 + sway, h * 0.38, w * 0.025, 0, Math.PI * 2);
  ctx.fill();
}

export const ALL_ACCESSORIES: AccessoryDef[] = [
  { id: 'hat_propeller', name: 'Propeller Hat', nameCN: '竹蜻蜓帽', category: 'hat', draw: hatPropeller },
  { id: 'hat_crown', name: 'Crown', nameCN: '皇冠', category: 'hat', draw: hatCrown },
  { id: 'glasses_round', name: 'Round Glasses', nameCN: '圆框眼镜', category: 'glasses', draw: glassesRound },
  { id: 'glasses_sunglasses', name: 'Sunglasses', nameCN: '墨镜', category: 'glasses', draw: glassesSunglasses },
  { id: 'scarf_warm', name: 'Warm Scarf', nameCN: '保暖围巾', category: 'scarf', draw: scarfWarm },
  { id: 'collar_spiked', name: 'Spiked Collar', nameCN: '铆钉项圈', category: 'collar', draw: collarSpiked },
  { id: 'ears_bunny', name: 'Bunny Ears', nameCN: '兔耳朵', category: 'ears', draw: earsBunny },
  { id: 'ears_cat', name: 'Cat Ears', nameCN: '猫耳朵', category: 'ears', draw: earsCat },
  { id: 'tail_cat', name: 'Cat Tail', nameCN: '猫尾巴', category: 'tail', draw: tailCat },
];

export function getAccessoryById(id: string): AccessoryDef | undefined {
  return ALL_ACCESSORIES.find(a => a.id === id);
}

export function getAccessoriesByCategory(cat: AccessoryDef['category']): AccessoryDef[] {
  return ALL_ACCESSORIES.filter(a => a.category === cat);
}
