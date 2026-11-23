// WCAG relative-luminance calculation for the actual stylesheet text colors.
const assert = require('node:assert/strict');
function luminance(hex) {
    const rgb = hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
for (const [foreground, background] of [['222222', 'f4f1e8'], ['222222', 'ffffff'], ['ffffff', '30543d'], ['30543d', 'ffffff'], ['222222', 'e4b46b']]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    const ratio = (values[0] + .05) / (values[1] + .05);
    assert.ok(ratio >= 4.5);
    console.log(`#${foreground} on #${background}: ${ratio.toFixed(2)}:1 PASS`);
}
