import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const packageRoot = new URL('../../google-apps-script/host-intake/', import.meta.url);
const source = ['Core.gs', 'Config.gs', 'Code.gs']
  .map((name) => readFileSync(new URL(name, packageRoot), 'utf8'))
  .join('\n');

function makeSheet(name, initialValues = [[]]) {
  return {
    name,
    values: initialValues.map((row) => [...row]),
    failAppend: null,
    failSet: null,
    setName(nextName) { this.name = nextName; return this; },
    getDataRange() { return { getValues: () => this.values.map((row) => [...row]) }; },
    getRange(row, column, rowCount = 1, columnCount = 1) {
      const sheet = this;
      const ensure = (r, c) => {
        while (sheet.values.length < r) sheet.values.push([]);
        while (sheet.values[r - 1].length < c) sheet.values[r - 1].push('');
      };
      const range = {
        setValue(value) {
          if (sheet.failSet && sheet.failSet(row, column, value)) throw new Error('set failed');
          ensure(row, column);
          sheet.values[row - 1][column - 1] = value;
          return range;
        },
        clearContent() { ensure(row, column); sheet.values[row - 1][column - 1] = ''; return range; },
        setValues(rows) {
          for (let r = 0; r < rowCount; r += 1) {
            for (let c = 0; c < columnCount; c += 1) {
              ensure(row + r, column + c);
              sheet.values[row + r - 1][column + c - 1] = rows[r][c];
            }
          }
          return range;
        },
        setFontWeight() { return range; },
        setBackground() { return range; },
        setFontColor() { return range; },
      };
      return range;
    },
    setFrozenRows() {},
    appendRow(row) {
      if (this.failAppend) throw this.failAppend;
      this.values.push([...row]);
      return this;
    },
  };
}

function makeWorkbook(id, initialSheet = makeSheet('Sheet1')) {
  return {
    id,
    sheets: [initialSheet],
    getId: () => id,
    getUrl: () => `https://docs.google.com/spreadsheets/d/${id}/edit`,
    getSheets() { return this.sheets; },
    insertSheet(name) { const sheet = makeSheet(name); this.sheets.push(sheet); return sheet; },
    getSheetByName(name) { return this.sheets.find((sheet) => sheet.name === name) || null; },
  };
}

function makeForm(id = 'form-1') {
  function item(type) {
    return {
      type, title: '', choices: [], required: false,
      setTitle(value) { this.title = value; return this; },
      setHelpText(value) { this.helpText = value; return this; },
      setRequired(value) { this.required = value; return this; },
      setChoiceValues(value) { this.choices = [...value]; return this; },
      setChoices(value) { this.choices = [...value]; return this; },
      createChoice(value, destination) { return { value, destination }; },
      setValidation(value) { this.validation = value; return this; },
      setGoToPage(value) { this.goToPage = value; return this; },
      asMultipleChoiceItem() { return this; },
      getTitle() { return this.title; },
    };
  }
  return {
    id, items: [], acceptingResponses: true, destination: null,
    getId: () => id,
    getEditUrl: () => `https://docs.google.com/forms/d/${id}/edit`,
    getPublishedUrl: () => `https://docs.google.com/forms/d/e/${id}/viewform`,
    setDescription(value) { this.description = value; return this; },
    setConfirmationMessage(value) { this.confirmationMessage = value; return this; },
    setProgressBar(value) { this.progressBar = value; return this; },
    setShuffleQuestions(value) { this.shuffleQuestions = value; return this; },
    setLimitOneResponsePerUser(value) { this.limitOne = value; return this; },
    setCollectEmail(value) { this.collectEmail = value; return this; },
    setDestination(type, workbookId) { this.destination = { type, workbookId }; return this; },
    setCustomClosedFormMessage(value) { this.closedMessage = value; return this; },
    setAcceptingResponses(value) { this.acceptingResponses = value; return this; },
    addTextItem() { const value = item('TEXT'); this.items.push(value); return value; },
    addParagraphTextItem() { const value = item('PARAGRAPH'); this.items.push(value); return value; },
    addTimeItem() { const value = item('TIME'); this.items.push(value); return value; },
    addMultipleChoiceItem() { const value = item('MULTIPLE_CHOICE'); this.items.push(value); return value; },
    addPageBreakItem() { const value = item('PAGE_BREAK'); this.items.push(value); return value; },
    getItems(type) { return this.items.filter((value) => value.type === type); },
  };
}

function createAppsScriptHarness(options = {}) {
  const coordination = makeSheet('Host Intake Dates', options.coordinationValues || [
    ['Available Sunday', 'Status', 'Candidate ID', 'Hold Expires'],
    ['2026-11-08', 'Open', '', ''],
  ]);
  const coordinationWorkbook = makeWorkbook(
    '10PnfOUjgzTe3eJ4pXGzp9QCJTFXZUP4KwmhY5zpOUdQ', coordination,
  );
  const properties = { ...(options.properties || {}) };
  const workbooks = new Map([[coordinationWorkbook.id, coordinationWorkbook]]);
  const forms = new Map();
  const createdForms = [];
  const createdWorkbooks = [];
  const triggers = [];
  const locks = [];
  const context = {
    console: { log() {} },
    FormApp: {
      DestinationType: { SPREADSHEET: 'SPREADSHEET' },
      ItemType: { MULTIPLE_CHOICE: 'MULTIPLE_CHOICE' },
      create(title) {
        const form = makeForm(`form-${createdForms.length + 1}`);
        form.title = title; forms.set(form.id, form); createdForms.push(form); return form;
      },
      openById(id) { const form = forms.get(id); if (!form) throw new Error(`unknown form: ${id}`); return form; },
      createTextValidation() {
        const builder = {
          requireTextMatchesPattern() { return builder; }, requireTextIsEmail() { return builder; },
          setHelpText() { return builder; }, build() { return { valid: true }; },
        };
        return builder;
      },
    },
    SpreadsheetApp: {
      openById(id) { const book = workbooks.get(id); if (!book) throw new Error(`unknown workbook: ${id}`); return book; },
      create() {
        const book = makeWorkbook(`workbook-${createdWorkbooks.length + 1}`);
        workbooks.set(book.id, book); createdWorkbooks.push(book); return book;
      },
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => properties[key] || null,
      setProperties: (values) => Object.assign(properties, values),
    }) },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      newTrigger(handler) {
      const trigger = { handler, getHandlerFunction: () => handler };
      const builder = {
        forForm(form) { trigger.form = form; return builder; }, onFormSubmit() { trigger.kind = 'submit'; return builder; },
        timeBased() { trigger.kind = 'time'; return builder; }, everyHours(value) { trigger.everyHours = value; return builder; },
        everyDays(value) { trigger.everyDays = value; return builder; }, atHour(value) { trigger.atHour = value; return builder; },
        create() { triggers.push(trigger); return trigger; },
      };
      return builder;
    } },
    Utilities: { formatDate: () => options.today || '2026-10-04', getUuid: () => options.uuid || 'uuid-1' },
    LockService: { getScriptLock() {
      const lock = { waited: false, released: false, waitLock() { this.waited = true; }, releaseLock() { this.released = true; } };
      locks.push(lock); return lock;
    } },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'operator@example.com' }) },
  };
  vm.runInNewContext(source, context);
  if (!options.rollingDates) context.extendProposedDates_ = () => {};

  const makeResponse = (overrides = {}) => {
    const answers = {
      '可选活动日期': '2026-11-08（周日）', '活动短标题': '候选活动',
      '是否使用默认活动安排？': '是，使用默认安排', 微信号: 'host-wechat', 邮箱: 'host@example.com',
      ...overrides,
    };
    return {
      getTimestamp: () => new Date('2026-10-04T19:00:00.000Z'),
      getItemResponses: () => Object.entries(answers).map(([title, answer]) => ({
        getItem: () => ({ getTitle: () => title }), getResponse: () => answer,
      })),
    };
  };
  return { context, coordination, properties, createdForms, createdWorkbooks, triggers, locks, makeResponse };
}

test('provisions form, workbook, properties, and triggers', () => {
  const h = createAppsScriptHarness();
  const links = h.context.setupHostIntake();
  assert.equal(h.createdForms.length, 1);
  assert.equal(h.createdWorkbooks.length, 1);
  assert.equal(h.createdForms[0].destination.workbookId, h.createdWorkbooks[0].id);
  assert.equal(h.properties.HOST_INTAKE_FORM_ID, h.createdForms[0].id);
  assert.equal(links.formPublicUrl, h.createdForms[0].getPublishedUrl());
  assert.deepEqual(h.triggers.map((value) => value.handler), ['onHostFormSubmit', 'refreshAvailableSundayChoices', 'releaseExpiredHolds']);
  assert.ok(h.createdWorkbooks[0].getSheetByName('Candidates'));
  assert.ok(h.createdWorkbooks[0].getSheetByName('Operations Log'));
});

test('rolling proposal dates cover six months without reopening existing bookings', () => {
  const h = createAppsScriptHarness({ rollingDates: true });
  h.context.setupHostIntake();
  h.coordination.values.push(['2026-11-01', 'Booked', 'C-booked', '']);
  const choices = Array.from(h.context.refreshAvailableSundayChoices());
  assert.equal(choices[0], '2026-10-11（周日）');
  assert.equal(choices.at(-1), '2027-04-04（周日）');
  assert.ok(!choices.includes('2026-11-01（周日）'));
  assert.equal(h.coordination.values.find((row) => row[0] === '2026-11-01')[1], 'Booked');
  const count = h.coordination.values.length;
  h.context.refreshAvailableSundayChoices();
  assert.equal(h.coordination.values.length, count);
});

test('refuses duplicate provisioning before creating artifacts', () => {
  const h = createAppsScriptHarness({ properties: { HOST_INTAKE_FORM_ID: 'existing' } });
  assert.throws(() => h.context.setupHostIntake(), /already provisioned/u);
  assert.equal(h.createdForms.length, 0);
  assert.equal(h.createdWorkbooks.length, 0);
  assert.equal(h.triggers.length, 0);
});

test('repair restores only missing triggers without creating duplicate resources', () => {
  const h = createAppsScriptHarness();
  const links = h.context.setupHostIntake();
  h.triggers.splice(1, 1);
  h.createdWorkbooks[0].getSheetByName('Candidates').values[0].pop();
  const repaired = h.context.repairHostIntake();
  assert.equal(h.createdForms.length, 1);
  assert.equal(h.createdWorkbooks.length, 1);
  assert.deepEqual(repaired, links);
  assert.deepEqual(
    h.triggers.map((value) => value.handler).sort(),
    ['onHostFormSubmit', 'refreshAvailableSundayChoices', 'releaseExpiredHolds'].sort(),
  );
  assert.equal(h.createdWorkbooks[0].getSheetByName('Candidates').values[0].at(-1), 'Operator Action');
});

test('refresh closes the form when no Sundays are open', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  h.coordination.values[1] = ['2026-11-08', 'Held', 'C-existing', '2026-10-11T00:00:00.000Z'];
  assert.deepEqual(Array.from(h.context.refreshAvailableSundayChoices()), []);
  assert.equal(h.createdForms[0].acceptingResponses, false);
  assert.match(h.createdForms[0].closedMessage, /没有开放的周日/u);
});

test('refresh reopens the form and replaces choices', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  h.createdForms[0].acceptingResponses = false;
  h.coordination.values.push(['2026-11-15', 'Open', '', '']);
  const locksBefore = h.locks.length;
  const choices = h.context.refreshAvailableSundayChoices();
  assert.deepEqual(Array.from(choices), ['2026-11-08（周日）', '2026-11-15（周日）']);
  assert.equal(h.createdForms[0].acceptingResponses, true);
  assert.deepEqual(
    Array.from(h.createdForms[0].items.find((value) => value.title === '可选活动日期').choices),
    Array.from(choices),
  );
  assert.equal(h.locks.length, locksBefore + 1);
  assert.equal(h.locks.at(-1).waited, true);
  assert.equal(h.locks.at(-1).released, true);
});

test('refresh fails loudly when the Sunday question is missing', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  h.createdForms[0].items = h.createdForms[0].items.filter((value) => value.title !== '可选活动日期');
  assert.throws(() => h.context.refreshAvailableSundayChoices(), /Available Sunday question was not found/u);
});

test('submission holds Sunday and appends candidate and audit rows', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  const id = h.context.onHostFormSubmit({ response: h.makeResponse() });
  assert.equal(id, 'C-uuid-1');
  assert.equal(h.coordination.values[1][1], 'Held');
  assert.equal(h.coordination.values[1][2], id);
  assert.match(h.coordination.values[1][3], /^2026-10-11T/u);
  const workbook = h.createdWorkbooks[0];
  assert.equal(workbook.getSheetByName('Candidates').values[1][0], id);
  assert.equal(workbook.getSheetByName('Candidates').values[1][14], 'host@example.com');
  assert.equal(workbook.getSheetByName('Operations Log').values[1][1], id);
  assert.equal(h.locks.length, 1, 'submit must refresh through the already-held lock');
  assert.equal(h.locks.at(-1).released, true);
});

test('submission passes configured hold days into candidate expiry', () => {
  const h = createAppsScriptHarness();
  h.context.HOST_INTAKE_CONFIG = Object.freeze({
    ...h.context.HOST_INTAKE_CONFIG,
    holdDays: 3,
  });
  h.context.setupHostIntake();

  h.context.onHostFormSubmit({ response: h.makeResponse() });

  assert.equal(h.coordination.values[1][3], '2026-10-07T19:00:00.000Z');
});

test('submission rolls back writes made before a coordination update fails', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  let failed = false;
  h.coordination.failSet = (_row, column) => {
    if (!failed && column === 3) { failed = true; return true; }
    return false;
  };

  assert.throws(() => h.context.onHostFormSubmit({ response: h.makeResponse() }), /set failed/u);
  assert.deepEqual(h.coordination.values[1], ['2026-11-08', 'Open', '', '']);
});

test('submission restores coordination row when candidate append fails', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  h.createdWorkbooks[0].getSheetByName('Candidates').failAppend = new Error('candidate append failed');
  assert.throws(() => h.context.onHostFormSubmit({ response: h.makeResponse() }), /candidate append failed/u);
  assert.deepEqual(h.coordination.values[1], ['2026-11-08', 'Open', '', '']);
  assert.equal(h.locks.at(-1).released, true);
});

test('expiry releases coordination date and candidate hold and logs transition', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  h.context.onHostFormSubmit({ response: h.makeResponse() });
  const workbook = h.createdWorkbooks[0];
  const candidates = workbook.getSheetByName('Candidates');
  candidates.values[1][18] = '2000-01-01T00:00:00.000Z';
  assert.equal(h.context.releaseExpiredHolds(), 1);
  assert.deepEqual(h.coordination.values[1], ['2026-11-08', 'Open', '', '']);
  assert.equal(candidates.values[1][17], 'Released');
  assert.equal(workbook.getSheetByName('Operations Log').values.at(-1)[3], 'Candidate / Released');
  assert.equal(h.createdForms[0].acceptingResponses, true);
});

test('expiry does not reopen a row no longer Held by that candidate', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  h.context.onHostFormSubmit({ response: h.makeResponse() });
  const candidates = h.createdWorkbooks[0].getSheetByName('Candidates');
  candidates.values[1][18] = '2000-01-01T00:00:00.000Z';
  h.coordination.values[1][1] = 'Booked';

  assert.equal(h.context.releaseExpiredHolds(), 0);
  assert.deepEqual(h.coordination.values[1].slice(0, 3), ['2026-11-08', 'Booked', 'C-uuid-1']);
  assert.equal(candidates.values[1][17], 'Held');
});

test('confirmation makes the booking terminal and prevents expiry reopening', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  const candidateId = h.context.onHostFormSubmit({ response: h.makeResponse() });

  assert.equal(h.context.confirmCandidate(candidateId), candidateId);
  const workbook = h.createdWorkbooks[0];
  const candidates = workbook.getSheetByName('Candidates');
  assert.equal(candidates.values[1][16], 'Confirmed');
  assert.equal(candidates.values[1][17], 'Booked');
  assert.equal(candidates.values[1][19], 'Not published');
  assert.equal(h.coordination.values[1][1], 'Booked');
  assert.equal(h.coordination.values[1][2], candidateId);
  assert.equal(h.coordination.values[1][3], '');
  candidates.values[1][18] = '2000-01-01T00:00:00.000Z';
  assert.equal(h.context.releaseExpiredHolds(), 0);
  assert.equal(h.coordination.values[1][1], 'Booked');
  assert.equal(workbook.getSheetByName('Operations Log').values.at(-1)[3], 'Confirmed / Booked');
});

test('operator confirms the single row marked Confirm without a function argument', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  const candidateId = h.context.onHostFormSubmit({ response: h.makeResponse() });
  const candidates = h.createdWorkbooks[0].getSheetByName('Candidates');
  candidates.values[1][21] = 'Confirm';
  assert.equal(h.context.confirmCandidate(), candidateId);
  assert.equal(candidates.values[1][16], 'Confirmed');
  assert.equal(candidates.values[1][17], 'Booked');
  assert.equal(candidates.values[1][21], 'Confirmed');
});

test('confirmation resumes safely after a partial cross-sheet write', () => {
  const h = createAppsScriptHarness();
  h.context.setupHostIntake();
  const candidateId = h.context.onHostFormSubmit({ response: h.makeResponse() });
  const candidates = h.createdWorkbooks[0].getSheetByName('Candidates');
  let failed = false;
  candidates.failSet = (row, column) => {
    if (!failed && row === 2 && column === 17) { failed = true; return true; }
    return false;
  };
  assert.throws(() => h.context.confirmCandidate(candidateId), /set failed/u);
  assert.equal(h.coordination.values[1][1], 'Booked');
  candidates.failSet = null;
  assert.equal(h.context.confirmCandidate(candidateId), candidateId);
  assert.equal(candidates.values[1][16], 'Confirmed');
  assert.equal(candidates.values[1][17], 'Booked');
});
