import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadCore() {
  const filename = new URL('../../google-apps-script/host-intake/Core.gs', import.meta.url);
  if (!existsSync(filename)) return {};
  const context = {};
  vm.runInNewContext(readFileSync(filename, 'utf8'), context, { filename: String(filename) });
  return context;
}

test('selects only future available Sundays by configured header names', () => {
  const { extractAvailableSundays } = loadCore();
  assert.equal(typeof extractAvailableSundays, 'function');

  const dates = extractAvailableSundays([
    ['活动日期', '状态', '备注'],
    ['2026-11-08', 'Available', ''],
    ['2026-11-07', 'Available', 'Saturday'],
    ['2026-11-01', '开放', ''],
    ['2026-10-11', 'Booked', ''],
    ['2026-09-27', 'Available', 'past'],
  ], {
    dateHeader: '活动日期',
    statusHeader: '状态',
    availableValues: ['Available', '开放'],
    asOf: '2026-10-04',
  });

  assert.deepEqual(Array.from(dates), ['2026-11-01', '2026-11-08']);
});

test('defines the agreed host questions without a poster upload', () => {
  const { buildHostFormDefinition } = loadCore();
  assert.equal(typeof buildHostFormDefinition, 'function');

  const form = buildHostFormDefinition(['2026-11-01', '2026-11-08']);
  assert.equal(form.title, '启发说 Host 活动候选提交');
  assert.deepEqual(
    Array.from(form.fields.filter((field) => field.required).map((field) => field.key)),
    ['requestedSunday', 'title', 'standardLogistics', 'wechatId', 'email'],
  );
  assert.deepEqual(
    Array.from(form.fields.find((field) => field.key === 'requestedSunday').choices),
    ['2026-11-01（周日）', '2026-11-08（周日）'],
  );
  assert.equal(form.fields.some((field) => /poster|海报/u.test(field.key + field.title)), false);
  assert.equal(form.defaults.startTime, '14:00');
  assert.equal(form.defaults.endTime, '17:00');
  assert.equal(form.defaults.location, 'Bellevue Library');
  assert.equal(form.defaults.capacity, 16);
  assert.equal(form.defaults.eventType, '科普 / 分享');
  assert.deepEqual(
    Array.from(form.fields
      .filter((field) => field.key.startsWith('override'))
      .map((field) => field.conditionalRequired)),
    [true, true, true, true],
  );
});

test('normalizes a private candidate and applies standard logistics', () => {
  const { normalizeCandidateSubmission } = loadCore();
  assert.equal(typeof normalizeCandidateSubmission, 'function');

  const candidate = normalizeCandidateSubmission({
    requestedSunday: '2026-11-01（周日）',
    title: '从城市规划看西雅图',
    description: '用几个本地案例聊聊城市如何被塑造。',
    materialUrl: '',
    standardLogistics: '是，使用默认安排',
    wechatId: 'host_wechat',
    email: 'host@example.com',
    otherNotes: '运营请提前联系我。',
  }, {
    allowedSundays: ['2026-11-01'],
    candidateId: 'C-20261004-001',
    submittedAt: '2026-10-04T12:00:00-07:00',
  });

  assert.equal(candidate.reviewState, 'Candidate');
  assert.equal(candidate.holdState, 'Held');
  assert.equal(candidate.startTime, '14:00');
  assert.equal(candidate.endTime, '17:00');
  assert.equal(candidate.location, 'Bellevue Library');
  assert.equal(candidate.capacity, 16);
  assert.equal(candidate.eventType, '科普 / 分享');
  assert.equal(candidate.email, 'host@example.com');
  assert.equal(candidate.wechatId, 'host_wechat');
  assert.equal(candidate.otherNotes, '运营请提前联系我。');
  assert.equal(candidate.publicationState, 'Not published');
});

test('uses explicit logistics only when the host opts out of defaults', () => {
  const { normalizeCandidateSubmission } = loadCore();
  const candidate = normalizeCandidateSubmission({
    requestedSunday: '2026-11-01',
    title: '特殊场地分享',
    standardLogistics: '否，需要特殊安排',
    overrideStartTime: '13:30',
    overrideEndTime: '16:00',
    overrideLocation: 'Redmond Library',
    overrideCapacity: '20',
    wechatId: 'wechat',
    email: 'host@example.com',
  }, {
    allowedSundays: ['2026-11-01'],
    candidateId: 'C-1',
    submittedAt: '2026-10-04T12:00:00-07:00',
  });

  assert.equal(candidate.startTime, '13:30');
  assert.equal(candidate.endTime, '16:00');
  assert.equal(candidate.location, 'Redmond Library');
  assert.equal(candidate.capacity, 20);
});

test('uses the configured hold duration', () => {
  const { normalizeCandidateSubmission } = loadCore();
  const candidate = normalizeCandidateSubmission({
    requestedSunday: '2026-11-01',
    title: '候选活动',
    standardLogistics: '是，使用默认安排',
    wechatId: 'wechat',
    email: 'host@example.com',
  }, {
    allowedSundays: ['2026-11-01'],
    candidateId: 'C-1',
    submittedAt: '2026-10-04T12:00:00.000Z',
    holdDays: 3,
  });

  assert.equal(candidate.holdExpiresAt, '2026-10-07T12:00:00.000Z');
});

test('rejects unavailable dates and missing private contact fields', () => {
  const { normalizeCandidateSubmission } = loadCore();
  const base = {
    requestedSunday: '2026-11-08',
    title: '候选活动',
    standardLogistics: '是，使用默认安排',
    wechatId: 'wechat',
    email: 'host@example.com',
  };
  const options = {
    allowedSundays: ['2026-11-01'],
    candidateId: 'C-1',
    submittedAt: '2026-10-04T12:00:00-07:00',
  };

  assert.throws(
    () => normalizeCandidateSubmission(base, options),
    /selected Sunday is not available/u,
  );
  assert.throws(
    () => normalizeCandidateSubmission({ ...base, requestedSunday: '2026-11-01', wechatId: '' }, options),
    /WeChat ID is required/u,
  );
  assert.throws(
    () => normalizeCandidateSubmission({ ...base, requestedSunday: '2026-11-01', email: '' }, options),
    /email is required/u,
  );
});

test('public projection excludes contact details and private notes', () => {
  const { toPublicCandidate } = loadCore();
  assert.equal(typeof toPublicCandidate, 'function');

  const publicRecord = toPublicCandidate({
    candidateId: 'C-1',
    requestedSunday: '2026-11-01',
    title: '公开标题',
    description: '公开简介',
    materialUrl: 'https://docs.google.com/document/d/example',
    startTime: '14:00',
    endTime: '17:00',
    location: 'Bellevue Library',
    capacity: 16,
    eventType: '科普 / 分享',
    email: 'private@example.com',
    wechatId: 'private-wechat',
    otherNotes: 'private note',
  });

  assert.deepEqual(Object.keys(publicRecord), [
    'candidateId',
    'requestedSunday',
    'title',
    'description',
    'materialUrl',
    'startTime',
    'endTime',
    'location',
    'capacity',
    'eventType',
  ]);
  assert.equal(JSON.stringify(publicRecord).includes('private'), false);
});

test('maps candidates to a stable private workbook schema', () => {
  const { candidateHeaders, candidateToRow } = loadCore();
  assert.equal(typeof candidateHeaders, 'function');
  assert.equal(typeof candidateToRow, 'function');
  const candidate = {
    candidateId: 'C-1', submittedAt: '2026-10-04T12:00:00-07:00',
    requestedSunday: '2026-11-01', title: 'Title', description: '', materialUrl: '',
    standardLogistics: true, startTime: '14:00', endTime: '17:00',
    location: 'Bellevue Library', capacity: 16, eventType: '科普 / 分享',
    timeZone: 'America/Los_Angeles', wechatId: 'wechat', email: 'host@example.com',
    otherNotes: 'private', reviewState: 'Candidate', holdState: 'Held',
    holdExpiresAt: '2026-10-11T19:00:00.000Z', publicationState: 'Not published',
  };
  const headers = Array.from(candidateHeaders());
  const row = Array.from(candidateToRow(candidate));
  assert.equal(headers.length, row.length);
  assert.equal(row[headers.indexOf('Candidate ID')], 'C-1');
  assert.equal(row[headers.indexOf('Email')], 'host@example.com');
  assert.equal(row[headers.indexOf('WeChat ID')], 'wechat');
  assert.equal(headers.some((header) => /poster/u.test(header)), false);
});

test('plans an atomic hold using verified coordination headers', () => {
  const { planSundayHold } = loadCore();
  assert.equal(typeof planSundayHold, 'function');
  const plan = planSundayHold([
    ['活动日期', '状态', 'Candidate ID', 'Hold Expires'],
    ['2026-11-01', 'Available', '', ''],
    ['2026-11-08', 'Booked', '', ''],
  ], {
    dateHeader: '活动日期',
    statusHeader: '状态',
    candidateIdHeader: 'Candidate ID',
    holdExpiresHeader: 'Hold Expires',
    availableValues: ['Available'],
    heldValue: 'Held',
  }, {
    date: '2026-11-01',
    candidateId: 'C-1',
    holdExpiresAt: '2026-10-11T19:00:00.000Z',
  });

  assert.equal(plan.rowNumber, 2);
  assert.deepEqual(Array.from(plan.writes, (write) => ({ ...write })), [
    { columnNumber: 2, value: 'Held', previousValue: 'Available' },
    { columnNumber: 3, value: 'C-1', previousValue: '' },
    { columnNumber: 4, value: '2026-10-11T19:00:00.000Z', previousValue: '' },
  ]);
});

test('refuses to hold an already booked Sunday', () => {
  const { planSundayHold } = loadCore();
  assert.throws(
    () => planSundayHold([
      ['Date', 'Status', 'Candidate', 'Expires'],
      ['2026-11-01', 'Booked', '', ''],
    ], {
      dateHeader: 'Date', statusHeader: 'Status', candidateIdHeader: 'Candidate',
      holdExpiresHeader: 'Expires', availableValues: ['Available'], heldValue: 'Held',
    }, {
      date: '2026-11-01', candidateId: 'C-1', holdExpiresAt: 'later',
    }),
    /Sunday is no longer available/u,
  );
});

test('closes the form cleanly when no Sundays are available', () => {
  const { buildAvailabilityFormState } = loadCore();
  assert.deepEqual(
    { ...buildAvailabilityFormState([]) },
    { acceptingResponses: false, choices: [] },
  );
  assert.deepEqual(
    { ...buildAvailabilityFormState(['2026-11-01']) },
    { acceptingResponses: true, choices: ['2026-11-01（周日）'] },
  );
});
