import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clampToGamut, colorsChanged, getHuePoint, getMirek } from '../source/js/utility/color.js';

let whitePoint = { x: 0.3127, y: 0.3290 };
let gamutC = {
  red: { x: 0.6915, y: 0.3083 },
  green: { x: 0.1700, y: 0.7000 },
  blue: { x: 0.1532, y: 0.0475 }
};

function assertClose(actual, expected, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

// Signed area tells which side of an edge a point is on, so a point is on or
// inside the triangle when it's on the same side of all three
function insideGamut(point, gamut) {
  let side = (a, b) => (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
  let sides = [side(gamut.red, gamut.green), side(gamut.green, gamut.blue), side(gamut.blue, gamut.red)];

  return sides.every(value => value >= -1e-9) || sides.every(value => value <= 1e-9);
}

describe('getHuePoint', () => {
  it('maps black to the white point rather than dividing by zero', () => {
    assert.deepEqual(getHuePoint([0, 0, 0]), whitePoint);
  });

  it('maps white and greys to D65', () => {
    for (let level of [255, 128, 30]) {
      let point = getHuePoint([level, level, level]);

      assertClose(point.x, whitePoint.x);
      assertClose(point.y, whitePoint.y);
    }
  });

  it('maps the sRGB primaries to their chromaticities', () => {
    let red = getHuePoint([255, 0, 0]);
    let green = getHuePoint([0, 255, 0]);
    let blue = getHuePoint([0, 0, 255]);

    assertClose(red.x, 0.64);
    assertClose(red.y, 0.33);
    assertClose(green.x, 0.30);
    assertClose(green.y, 0.60);
    assertClose(blue.x, 0.15);
    assertClose(blue.y, 0.06);
  });

  it('ignores an alpha channel', () => {
    assert.deepEqual(getHuePoint([200, 100, 50, 1]), getHuePoint([200, 100, 50]));
  });
});

describe('clampToGamut', () => {
  it('leaves points inside the gamut alone', () => {
    assert.deepEqual(clampToGamut(whitePoint, gamutC), whitePoint);
  });

  it('pulls points outside the gamut onto its edge', () => {
    for (let point of [{ x: 0.8, y: 0.2 }, { x: 0.05, y: 0.9 }, { x: 0.1, y: 0.0 }, { x: 0.4, y: 0.6 }]) {
      let clamped = clampToGamut(point, gamutC);

      assert.notDeepEqual(clamped, point);
      assert.ok(insideGamut(clamped, gamutC), `${JSON.stringify(clamped)} is outside the gamut`);
    }
  });

  it('snaps to the nearest corner past a vertex', () => {
    let clamped = clampToGamut({ x: 0.75, y: 0.3 }, gamutC);

    assertClose(clamped.x, gamutC.red.x);
    assertClose(clamped.y, gamutC.red.y);
  });

  it('falls back to Gamut C when a light reports none', () => {
    assert.deepEqual(clampToGamut({ x: 0.8, y: 0.2 }), clampToGamut({ x: 0.8, y: 0.2 }, gamutC));
  });
});

describe('getMirek', () => {
  let range = { min: 153, max: 500 };

  it('stays within the bulb range', () => {
    for (let color of [[255, 0, 0], [0, 0, 255], [0, 255, 0], [255, 255, 255]]) {
      let mirek = getMirek(getHuePoint(color), range);

      assert.ok(mirek >= range.min && mirek <= range.max, `${mirek} is out of range`);
    }
  });

  it('reads warm colors as warmer than cool ones', () => {
    let warm = getMirek(getHuePoint([255, 140, 40]), range);
    let cool = getMirek(getHuePoint([120, 170, 255]), range);

    assert.ok(warm > cool, `warm ${warm} should be a higher mirek than cool ${cool}`);
  });

  it('puts D65 white near 6500K', () => {
    assertClose(getMirek(whitePoint, range), 1000000 / 6500, 5);
  });
});

describe('colorsChanged', () => {
  let colors = [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }];

  it('treats the first set as a change', () => {
    assert.equal(colorsChanged(undefined, colors), true);
  });

  it('ignores an identical set', () => {
    assert.equal(colorsChanged(colors.map(color => ({ ...color })), colors), false);
  });

  it('notices a different length or value', () => {
    assert.equal(colorsChanged(colors.slice(1), colors), true);
    assert.equal(colorsChanged([colors[0], { x: 0.3, y: 0.5 }], colors), true);
  });
});
