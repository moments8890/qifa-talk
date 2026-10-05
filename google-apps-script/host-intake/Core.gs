var HOST_INTAKE_DEFAULTS = Object.freeze({
  startTime: '14:00',
  endTime: '17:00',
  location: 'Bellevue Library',
  capacity: 16,
  eventType: '科普 / 分享',
  timeZone: 'America/Los_Angeles',
});

function normalizedText(value) {
  return value == null ? '' : String(value).trim();
}

function normalizedDate(value) {
  var match = normalizedText(value).match(/^(\d{4}-\d{2}-\d{2})/u);
  return match ? match[1] : '';
}

function isSunday(date) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(date)
    && new Date(date + 'T00:00:00Z').getUTCDay() === 0;
}

function proposedSundays(asOf, months) {
  var start = new Date(asOf + 'T00:00:00Z');
  if (!Number.isFinite(start.getTime()) || !Number.isInteger(months) || months < 1) {
    throw new Error('A valid date and positive proposal month count are required.');
  }
  var end = new Date(start.getTime());
  var day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  var lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  var dates = [];
  // Start with the next Sunday, leaving no same-day booking option.
  start.setUTCDate(start.getUTCDate() + (7 - start.getUTCDay()));
  for (; start <= end; start.setUTCDate(start.getUTCDate() + 7)) {
    dates.push(start.toISOString().slice(0, 10));
  }
  return dates;
}

function extractAvailableSundays(values, options) {
  if (!Array.isArray(values) || values.length === 0) return [];
  var headers = values[0].map(normalizedText);
  var dateIndex = headers.indexOf(options.dateHeader);
  var statusIndex = headers.indexOf(options.statusHeader);
  if (dateIndex < 0) throw new Error('coordination date header not found');
  if (statusIndex < 0) throw new Error('coordination status header not found');
  var allowedStatuses = options.availableValues.map(function (value) {
    return normalizedText(value).toLocaleLowerCase();
  });
  var dates = values.slice(1).flatMap(function (row) {
    var date = normalizedDate(row[dateIndex]);
    var status = normalizedText(row[statusIndex]).toLocaleLowerCase();
    if (!isSunday(date) || date <= options.asOf ||
        (options.through && date > options.through) || allowedStatuses.indexOf(status) < 0) {
      return [];
    }
    return [date];
  });
  return Array.from(new Set(dates)).sort();
}

function buildHostFormDefinition(availableSundays) {
  if (!Array.isArray(availableSundays) || availableSundays.length === 0) {
    throw new Error('at least one available Sunday is required');
  }
  availableSundays.forEach(function (date) {
    if (!isSunday(date)) throw new Error('available date is not a Sunday: ' + date);
  });
  return {
    title: '启发说 Host 活动候选提交',
    description: [
      '此表单用于提交候选活动，不代表活动已经确认或公开。',
      '运营会通过微信或邮件联系你；确认后才会排期并发布到启发说网站。',
      '海报由运营制作和上传，不需要 Host 提交。',
    ].join('\n'),
    defaults: Object.assign({}, HOST_INTAKE_DEFAULTS),
    fields: [
      {
        key: 'requestedSunday',
        title: '可选活动日期',
        helpText: '请选择未来六个月内开放的周日。提交后临时保留活动日期；运营确认活动后再预约图书馆，最终日期及场地以运营确认为准。',
        type: 'multipleChoice',
        required: true,
        choices: availableSundays.map(function (date) { return date + '（周日）'; }),
      },
      {
        key: 'title',
        title: '活动短标题',
        helpText: '将作为网站、排期表和海报的公开标题。建议 8–30 个中文字符；请不要在这里填写活动简介。',
        type: 'text',
        required: true,
      },
      {
        key: 'description',
        title: '活动简介（可选）',
        helpText: '1–3 句话，建议约 50–150 个中文字符；可能用于网站和海报文案。',
        type: 'paragraph',
        required: false,
      },
      {
        key: 'materialUrl',
        title: '详细资料或 Google Doc 链接（可选）',
        helpText: '如有讨论提纲或详细材料，请填写 HTTPS 链接。',
        type: 'text',
        required: false,
      },
      {
        key: 'standardLogistics',
        title: '是否使用默认活动安排？',
        helpText: '默认：下午 2–5 点、Bellevue Library、容量 16。活动类型统一为“科普 / 分享”。',
        type: 'multipleChoice',
        required: true,
        choices: ['是，使用默认安排', '否，需要特殊安排'],
      },
      { key: 'overrideStartTime', title: '特殊开始时间', type: 'time', required: false, conditionalRequired: true },
      { key: 'overrideEndTime', title: '特殊结束时间', type: 'time', required: false, conditionalRequired: true },
      { key: 'overrideLocation', title: '特殊地点', type: 'text', required: false, conditionalRequired: true },
      { key: 'overrideCapacity', title: '特殊容量', type: 'text', required: false, conditionalRequired: true },
      {
        key: 'wechatId',
        title: '微信号',
        helpText: '仅用于活动预约和运营联系，不会公开。',
        type: 'text',
        required: true,
      },
      {
        key: 'email',
        title: '邮箱',
        helpText: '仅用于活动预约和运营联系，不会公开。',
        type: 'text',
        required: true,
      },
      {
        key: 'otherNotes',
        title: '其他说明（可选）',
        helpText: '仅供运营查看，默认不会公开。',
        type: 'paragraph',
        required: false,
      },
    ],
  };
}

function buildAvailabilityFormState(availableSundays) {
  return {
    acceptingResponses: availableSundays.length > 0,
    choices: availableSundays.map(function (date) { return date + '（周日）'; }),
  };
}

function required(value, label) {
  var text = normalizedText(value);
  if (!text) throw new Error(label + ' is required');
  return text;
}

function validTime(value, label) {
  var time = required(value, label);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(time)) {
    throw new Error(label + ' must use HH:mm');
  }
  return time;
}

function normalizeCandidateSubmission(answers, options) {
  var date = normalizedDate(required(answers.requestedSunday, 'selected Sunday'));
  if (!isSunday(date) || options.allowedSundays.indexOf(date) < 0) {
    throw new Error('selected Sunday is not available');
  }
  var title = required(answers.title, 'title');
  var wechatId = required(answers.wechatId, 'WeChat ID');
  var email = required(answers.email, 'email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error('email is invalid');
  }
  var materialUrl = normalizedText(answers.materialUrl);
  if (materialUrl && !/^https:\/\//u.test(materialUrl)) {
    throw new Error('material URL must use HTTPS');
  }

  var standard = answers.standardLogistics === '是，使用默认安排';
  var logistics = Object.assign({}, HOST_INTAKE_DEFAULTS);
  if (!standard) {
    logistics.startTime = validTime(answers.overrideStartTime, 'start time');
    logistics.endTime = validTime(answers.overrideEndTime, 'end time');
    if (logistics.endTime <= logistics.startTime) {
      throw new Error('end time must be after start time');
    }
    logistics.location = required(answers.overrideLocation, 'location');
    logistics.capacity = Number(required(answers.overrideCapacity, 'capacity'));
    if (!Number.isInteger(logistics.capacity) || logistics.capacity < 1) {
      throw new Error('capacity must be a positive integer');
    }
  }

  var holdDays = options.holdDays == null ? 7 : Number(options.holdDays);
  if (!Number.isInteger(holdDays) || holdDays < 1) {
    throw new Error('hold days must be a positive integer');
  }
  var submitted = new Date(options.submittedAt);
  var expires = new Date(submitted.getTime() + holdDays * 24 * 60 * 60 * 1000);
  return {
    candidateId: options.candidateId,
    submittedAt: options.submittedAt,
    requestedSunday: date,
    title: title,
    description: normalizedText(answers.description),
    materialUrl: materialUrl,
    standardLogistics: standard,
    startTime: logistics.startTime,
    endTime: logistics.endTime,
    location: logistics.location,
    capacity: logistics.capacity,
    eventType: logistics.eventType,
    timeZone: logistics.timeZone,
    wechatId: wechatId,
    email: email,
    otherNotes: normalizedText(answers.otherNotes),
    reviewState: 'Candidate',
    holdState: 'Held',
    holdExpiresAt: expires.toISOString(),
    publicationState: 'Not published',
  };
}

function toPublicCandidate(candidate) {
  return {
    candidateId: candidate.candidateId,
    requestedSunday: candidate.requestedSunday,
    title: candidate.title,
    description: candidate.description,
    materialUrl: candidate.materialUrl,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    location: candidate.location,
    capacity: candidate.capacity,
    eventType: candidate.eventType,
  };
}

function candidateHeaders() {
  return [
    'Candidate ID', 'Submitted At', 'Requested Sunday', 'Title',
    'Description', 'Material URL', 'Standard Logistics', 'Start Time',
    'End Time', 'Location', 'Capacity', 'Event Type', 'Time Zone',
    'WeChat ID', 'Email', 'Other Notes', 'Review State', 'Hold State',
    'Hold Expires At', 'Publication State', 'Operations Notes', 'Operator Action',
  ];
}

function candidateToRow(candidate) {
  return [
    candidate.candidateId,
    candidate.submittedAt,
    candidate.requestedSunday,
    candidate.title,
    candidate.description,
    candidate.materialUrl,
    candidate.standardLogistics ? 'Default' : 'Override',
    candidate.startTime,
    candidate.endTime,
    candidate.location,
    candidate.capacity,
    candidate.eventType,
    candidate.timeZone,
    candidate.wechatId,
    candidate.email,
    candidate.otherNotes,
    candidate.reviewState,
    candidate.holdState,
    candidate.holdExpiresAt,
    candidate.publicationState,
    '',
    '',
  ];
}

function planSundayHold(values, config, hold) {
  if (!Array.isArray(values) || values.length < 2) {
    throw new Error('coordination sheet has no availability rows');
  }
  var headers = values[0].map(normalizedText);
  function columnNumber(headerName) {
    var index = headers.indexOf(headerName);
    if (index < 0) throw new Error('coordination header not found: ' + headerName);
    return index + 1;
  }
  var dateColumn = columnNumber(config.dateHeader);
  var statusColumn = columnNumber(config.statusHeader);
  var candidateColumn = columnNumber(config.candidateIdHeader);
  var expiresColumn = columnNumber(config.holdExpiresHeader);
  var matchingRows = [];
  values.slice(1).forEach(function (row, index) {
    if (normalizedDate(row[dateColumn - 1]) === hold.date) matchingRows.push(index + 2);
  });
  if (matchingRows.length !== 1) {
    throw new Error('selected Sunday must match exactly one coordination row');
  }
  var rowNumber = matchingRows[0];
  var row = values[rowNumber - 1];
  var status = normalizedText(row[statusColumn - 1]).toLocaleLowerCase();
  var available = config.availableValues.some(function (value) {
    return normalizedText(value).toLocaleLowerCase() === status;
  });
  if (!available) throw new Error('Sunday is no longer available');
  return {
    rowNumber: rowNumber,
    writes: [
      {
        columnNumber: statusColumn,
        value: config.heldValue,
        previousValue: row[statusColumn - 1],
      },
      {
        columnNumber: candidateColumn,
        value: hold.candidateId,
        previousValue: row[candidateColumn - 1],
      },
      {
        columnNumber: expiresColumn,
        value: hold.holdExpiresAt,
        previousValue: row[expiresColumn - 1],
      },
    ],
  };
}
