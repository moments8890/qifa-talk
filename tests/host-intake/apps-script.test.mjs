import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const packageRoot = new URL('../../google-apps-script/host-intake/', import.meta.url);

function read(name) {
  const url = new URL(name, packageRoot);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
}

test('Apps Script package exposes provisioning and maintenance entry points', () => {
  const context = {};
  vm.runInNewContext(
    [read('Core.gs'), read('Config.gs'), read('Code.gs')].join('\n'),
    context,
  );
  for (const name of [
    'setupHostIntake',
    'getHostIntakeLinks',
    'refreshAvailableSundayChoices',
    'onHostFormSubmit',
    'confirmCandidate',
    'releaseExpiredHolds',
  ]) {
    assert.equal(typeof context[name], 'function', `${name} must be defined`);
  }
});

test('configuration targets the existing coordination workbook without storing secrets', () => {
  const source = read('Config.gs');
  assert.match(source, /10PnfOUjgzTe3eJ4pXGzp9QCJTFXZUP4KwmhY5zpOUdQ/u);
  assert.match(source, /coordinationSheetName:\s*'Host Intake Dates'/u);
  assert.match(source, /dateHeader:\s*'Available Sunday'/u);
  assert.match(source, /statusHeader:\s*'Status'/u);
  assert.match(source, /availableValues:\s*\['Open'\]/u);
  assert.match(source, /heldValue:\s*'Held'/u);
  assert.match(source, /bookedValue:\s*'Booked'/u);
  assert.doesNotMatch(source, /TODO_/u);
  assert.doesNotMatch(source, /client_secret|private_key|@gmail\.com/iu);
});

test('manifest uses the Pacific time zone and V8 runtime', () => {
  const manifest = JSON.parse(read('appsscript.json'));
  assert.equal(manifest.timeZone, 'America/Los_Angeles');
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.equal(manifest.exceptionLogging, 'STACKDRIVER');
  assert.equal(manifest.executionApi, undefined);
});
