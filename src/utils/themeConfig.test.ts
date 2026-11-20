import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCENT_THEMES,
  getAccentOption,
  getMapStyleOption,
  isValidAccentColor,
  isValidMapStyle,
  MAP_STYLES,
  resolveCssAccentVars,
} from './themeConfig';

test('MAP_STYLES removed pastel and esri and provides 4 dark tones plus classic OSM', () => {
  const ids = MAP_STYLES.map((s) => s.id);
  assert.equal(ids.includes('pastel' as never), false);
  assert.equal(ids.includes('esri' as never), false);
  const darkCount = MAP_STYLES.filter((s) => s.isDark).length;
  assert.equal(darkCount, 4);
  assert.equal(MAP_STYLES.length, 5);
});

test('isValidMapStyle rejects removed styles and accepts valid dark/osm styles', () => {
  assert.equal(isValidMapStyle('pastel'), false);
  assert.equal(isValidMapStyle('esri'), false);
  assert.equal(isValidMapStyle('aurora'), true);
  assert.equal(isValidMapStyle('graphite'), true);
  assert.equal(isValidMapStyle('ambernight'), true);
  assert.equal(isValidMapStyle('twilight'), true);
  assert.equal(isValidMapStyle('osm'), true);
});

test('ACCENT_THEMES provides 6 customization colors and resolves CSS variables cleanly', () => {
  assert.equal(ACCENT_THEMES.length, 6);
  assert.equal(isValidAccentColor('sky'), true);
  assert.equal(isValidAccentColor('unknown'), false);

  const skyDark = resolveCssAccentVars('sky', 'dark');
  assert.equal(skyDark['--accent-primary'], '#38BDF8');
  assert.equal(skyDark['--accent-fg'], '#082F49');

  const indigoLight = resolveCssAccentVars('indigo', 'light');
  assert.equal(indigoLight['--accent-primary'], '#4F46E5');
  assert.equal(indigoLight['--accent-fg'], '#FFFFFF');

  assert.equal(getAccentOption('emerald').id, 'emerald');
  assert.equal(getMapStyleOption('aurora').id, 'aurora');
});
