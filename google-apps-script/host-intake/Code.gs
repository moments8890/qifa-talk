function assertHostIntakeConfigured_() {
  var values = [
    HOST_INTAKE_CONFIG.coordinationSpreadsheetId,
    HOST_INTAKE_CONFIG.coordinationSheetName,
    HOST_INTAKE_CONFIG.dateHeader,
    HOST_INTAKE_CONFIG.statusHeader,
    HOST_INTAKE_CONFIG.candidateIdHeader,
    HOST_INTAKE_CONFIG.holdExpiresHeader,
    HOST_INTAKE_CONFIG.heldValue,
    HOST_INTAKE_CONFIG.bookedValue,
  ].concat(HOST_INTAKE_CONFIG.availableValues);
  if (values.some(function (value) { return !normalizedText(value); })) {
    throw new Error('Host intake configuration values must not be empty.');
  }
}

function getCoordinationSheet_() {
  assertHostIntakeConfigured_();
  var workbook = SpreadsheetApp.openById(HOST_INTAKE_CONFIG.coordinationSpreadsheetId);
  var sheet = workbook.getSheetByName(HOST_INTAKE_CONFIG.coordinationSheetName);
  if (!sheet) throw new Error('Configured coordination Sheet tab was not found.');
  return sheet;
}

function coordinationValues_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length === 0) return values;
  var dateIndex = values[0].map(normalizedText).indexOf(HOST_INTAKE_CONFIG.dateHeader);
  if (dateIndex < 0) throw new Error('Configured coordination date header was not found.');
  return values.map(function (row, rowIndex) {
    return row.map(function (value, columnIndex) {
      if (rowIndex > 0 && columnIndex === dateIndex && value instanceof Date) {
        return Utilities.formatDate(value, HOST_INTAKE_CONFIG.timeZone, 'yyyy-MM-dd');
      }
      return value;
    });
  });
}

function availableSundays_(sheet) {
  return extractAvailableSundays(coordinationValues_(sheet), {
    dateHeader: HOST_INTAKE_CONFIG.dateHeader,
    statusHeader: HOST_INTAKE_CONFIG.statusHeader,
    availableValues: HOST_INTAKE_CONFIG.availableValues,
    asOf: Utilities.formatDate(new Date(), HOST_INTAKE_CONFIG.timeZone, 'yyyy-MM-dd'),
  });
}

function addTextField_(form, field) {
  var item = form.addTextItem()
    .setTitle(field.title)
    .setRequired(field.required || field.conditionalRequired || false);
  if (field.helpText) item.setHelpText(field.helpText);
  return item;
}

function addParagraphField_(form, field) {
  var item = form.addParagraphTextItem()
    .setTitle(field.title)
    .setRequired(field.required || field.conditionalRequired || false);
  if (field.helpText) item.setHelpText(field.helpText);
  return item;
}

function addTimeField_(form, field) {
  var item = form.addTimeItem()
    .setTitle(field.title)
    .setRequired(field.required || field.conditionalRequired || false);
  if (field.helpText) item.setHelpText(field.helpText);
  return item;
}

function fieldByKey_(definition, key) {
  var field = definition.fields.find(function (candidate) { return candidate.key === key; });
  if (!field) throw new Error('Unknown form field: ' + key);
  return field;
}

function buildGoogleForm_(definition) {
  var form = FormApp.create(definition.title)
    .setDescription(definition.description)
    .setConfirmationMessage('已收到候选活动。运营确认排期前，活动不会公开发布。我们会通过微信或邮件联系你。')
    .setProgressBar(true)
    .setShuffleQuestions(false)
    .setLimitOneResponsePerUser(false)
    .setCollectEmail(false);

  var sunday = fieldByKey_(definition, 'requestedSunday');
  form.addMultipleChoiceItem()
    .setTitle(sunday.title)
    .setHelpText(sunday.helpText)
    .setChoiceValues(sunday.choices)
    .setRequired(true);

  addTextField_(form, fieldByKey_(definition, 'title'));
  addParagraphField_(form, fieldByKey_(definition, 'description'));
  var material = addTextField_(form, fieldByKey_(definition, 'materialUrl'));
  material.setValidation(FormApp.createTextValidation()
    .requireTextMatchesPattern('^$|^https://.+')
    .setHelpText('请填写以 https:// 开头的链接，或留空。')
    .build());

  var logistics = fieldByKey_(definition, 'standardLogistics');
  var logisticsItem = form.addMultipleChoiceItem()
    .setTitle(logistics.title)
    .setHelpText(logistics.helpText)
    .setRequired(true);
  var overridePage = form.addPageBreakItem().setTitle('特殊活动安排');
  addTimeField_(form, fieldByKey_(definition, 'overrideStartTime'));
  addTimeField_(form, fieldByKey_(definition, 'overrideEndTime'));
  addTextField_(form, fieldByKey_(definition, 'overrideLocation'));
  var capacity = addTextField_(form, fieldByKey_(definition, 'overrideCapacity'));
  capacity.setValidation(FormApp.createTextValidation()
    .requireTextMatchesPattern('^$|^[1-9][0-9]*$')
    .setHelpText('请填写正整数，或使用默认安排。')
    .build());

  var contactPage = form.addPageBreakItem().setTitle('联系方式与其他说明');
  overridePage.setGoToPage(contactPage);
  logisticsItem.setChoices([
    logisticsItem.createChoice(logistics.choices[0], contactPage),
    logisticsItem.createChoice(logistics.choices[1], overridePage),
  ]);

  addTextField_(form, fieldByKey_(definition, 'wechatId'));
  var email = addTextField_(form, fieldByKey_(definition, 'email'));
  email.setValidation(FormApp.createTextValidation()
    .requireTextIsEmail()
    .setHelpText('请填写有效邮箱。')
    .build());
  addParagraphField_(form, fieldByKey_(definition, 'otherNotes'));
  return form;
}

function formatHeader_(sheet, width) {
  sheet.getRange(1, 1, 1, width)
    .setFontWeight('bold')
    .setBackground('#214d57')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function createPrivateWorkbook_() {
  var workbook = SpreadsheetApp.create('启发说 Host 候选活动（私密）');
  var candidates = workbook.getSheets()[0].setName(HOST_INTAKE_CONFIG.candidatesSheetName);
  var headers = candidateHeaders();
  candidates.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeader_(candidates, headers.length);
  var log = workbook.insertSheet(HOST_INTAKE_CONFIG.operationsLogSheetName);
  var logHeaders = ['Timestamp', 'Candidate ID', 'Previous State', 'Next State', 'Actor', 'Reason'];
  log.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
  formatHeader_(log, logHeaders.length);
  return workbook;
}

function installTriggers_(form) {
  var existingHandlers = ScriptApp.getProjectTriggers().map(function (trigger) {
    return trigger.getHandlerFunction();
  });
  if (existingHandlers.indexOf('onHostFormSubmit') < 0) {
    ScriptApp.newTrigger('onHostFormSubmit').forForm(form).onFormSubmit().create();
  }
  if (existingHandlers.indexOf('refreshAvailableSundayChoices') < 0) {
    ScriptApp.newTrigger('refreshAvailableSundayChoices').timeBased().everyHours(6).create();
  }
  if (existingHandlers.indexOf('releaseExpiredHolds') < 0) {
    ScriptApp.newTrigger('releaseExpiredHolds').timeBased().everyDays(1).atHour(1).create();
  }
}

function setupHostIntake() {
  assertHostIntakeConfigured_();
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('HOST_INTAKE_FORM_ID')) {
    throw new Error('Host intake is already provisioned. Use the stored Form URL.');
  }
  var dates = availableSundays_(getCoordinationSheet_());
  var definition = buildHostFormDefinition(dates);
  var workbook = createPrivateWorkbook_();
  var form = buildGoogleForm_(definition);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, workbook.getId());
  properties.setProperties({
    HOST_INTAKE_FORM_ID: form.getId(),
    HOST_INTAKE_WORKBOOK_ID: workbook.getId(),
    HOST_INTAKE_FORM_EDIT_URL: form.getEditUrl(),
    HOST_INTAKE_FORM_PUBLIC_URL: form.getPublishedUrl(),
    HOST_INTAKE_WORKBOOK_URL: workbook.getUrl(),
  }, false);
  installTriggers_(form);
  return getHostIntakeLinks();
}

function getHostIntakeLinks() {
  var properties = PropertiesService.getScriptProperties();
  var links = {
    formPublicUrl: properties.getProperty('HOST_INTAKE_FORM_PUBLIC_URL'),
    formEditUrl: properties.getProperty('HOST_INTAKE_FORM_EDIT_URL'),
    workbookUrl: properties.getProperty('HOST_INTAKE_WORKBOOK_URL'),
  };
  if (!links.formPublicUrl || !links.formEditUrl || !links.workbookUrl) {
    throw new Error('Run setupHostIntake first.');
  }
  console.log(JSON.stringify(links, null, 2));
  return links;
}

function repairHostIntake() {
  assertHostIntakeConfigured_();
  var properties = PropertiesService.getScriptProperties();
  var formId = properties.getProperty('HOST_INTAKE_FORM_ID');
  var workbookId = properties.getProperty('HOST_INTAKE_WORKBOOK_ID');
  if (!formId || !workbookId) {
    throw new Error('Host intake resources are incomplete. Run setupHostIntake first.');
  }
  var form = FormApp.openById(formId);
  SpreadsheetApp.openById(workbookId);
  ensureCandidateSchema_();
  installTriggers_(form);
  refreshAvailableSundayChoices();
  return getHostIntakeLinks();
}

function ensureCandidateSchema_() {
  var sheet = workbookSheet_(HOST_INTAKE_CONFIG.candidatesSheetName);
  var headers = sheet.getDataRange().getValues()[0].map(normalizedText);
  if (headers.indexOf('Operator Action') < 0) {
    sheet.getRange(1, headers.length + 1).setValue('Operator Action');
  }
}

function formAndDefinition_() {
  var properties = PropertiesService.getScriptProperties();
  var formId = properties.getProperty('HOST_INTAKE_FORM_ID');
  if (!formId) throw new Error('Run setupHostIntake first.');
  var dates = availableSundays_(getCoordinationSheet_());
  return { form: FormApp.openById(formId), dates: dates };
}

function refreshAvailableSundayChoicesUnlocked_() {
  var current = formAndDefinition_();
  var state = buildAvailabilityFormState(current.dates);
  if (!state.acceptingResponses) {
    current.form
      .setCustomClosedFormMessage('目前没有开放的周日，请稍后再查看或联系运营。')
      .setAcceptingResponses(false);
    return [];
  }
  var field = fieldByKey_(buildHostFormDefinition(current.dates), 'requestedSunday');
  var item = current.form.getItems(FormApp.ItemType.MULTIPLE_CHOICE)
    .map(function (candidate) { return candidate.asMultipleChoiceItem(); })
    .find(function (candidate) { return candidate.getTitle() === field.title; });
  if (!item) throw new Error('Available Sunday question was not found.');
  item.setChoiceValues(field.choices);
  current.form.setAcceptingResponses(true);
  return field.choices;
}

function refreshAvailableSundayChoices() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    return refreshAvailableSundayChoicesUnlocked_();
  } finally {
    lock.releaseLock();
  }
}

function answersFromResponse_(response, definition) {
  var titleToKey = {};
  definition.fields.forEach(function (field) { titleToKey[field.title] = field.key; });
  var answers = {};
  response.getItemResponses().forEach(function (itemResponse) {
    var key = titleToKey[itemResponse.getItem().getTitle()];
    if (key) answers[key] = itemResponse.getResponse();
  });
  return answers;
}

function workbookSheet_(name) {
  var workbookId = PropertiesService.getScriptProperties()
    .getProperty('HOST_INTAKE_WORKBOOK_ID');
  if (!workbookId) throw new Error('Run setupHostIntake first.');
  var sheet = SpreadsheetApp.openById(workbookId).getSheetByName(name);
  if (!sheet) throw new Error('Private workbook sheet not found: ' + name);
  return sheet;
}

function applyHoldPlan_(sheet, plan) {
  var applied = [];
  try {
    plan.writes.forEach(function (write) {
      sheet.getRange(plan.rowNumber, write.columnNumber).setValue(write.value);
      applied.push(write);
    });
  } catch (error) {
    var rollbackErrors = [];
    applied.reverse().forEach(function (write) {
      try {
        sheet.getRange(plan.rowNumber, write.columnNumber).setValue(write.previousValue);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message || String(rollbackError));
      }
    });
    if (rollbackErrors.length) {
      throw new Error((error.message || String(error)) + '; hold rollback failed: ' + rollbackErrors.join(', '));
    }
    throw error;
  }
}

function rollbackHoldPlan_(sheet, plan) {
  var errors = [];
  plan.writes.slice().reverse().forEach(function (write) {
    try {
      sheet.getRange(plan.rowNumber, write.columnNumber).setValue(write.previousValue);
    } catch (error) {
      errors.push(error.message || String(error));
    }
  });
  if (errors.length) throw new Error('Hold rollback failed: ' + errors.join(', '));
}

function appendOperationsLog_(candidateId, previousState, nextState, reason) {
  workbookSheet_(HOST_INTAKE_CONFIG.operationsLogSheetName).appendRow([
    new Date(), candidateId, previousState, nextState,
    Session.getEffectiveUser().getEmail() || 'Apps Script', reason,
  ]);
}

function onHostFormSubmit(event) {
  if (!event || !event.response) throw new Error('A Google Form submit event is required.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    var coordination = getCoordinationSheet_();
    var values = coordinationValues_(coordination);
    var allowedSundays = extractAvailableSundays(values, {
      dateHeader: HOST_INTAKE_CONFIG.dateHeader,
      statusHeader: HOST_INTAKE_CONFIG.statusHeader,
      availableValues: HOST_INTAKE_CONFIG.availableValues,
      asOf: Utilities.formatDate(new Date(), HOST_INTAKE_CONFIG.timeZone, 'yyyy-MM-dd'),
    });
    var definition = buildHostFormDefinition(allowedSundays);
    var candidateId = 'C-' + Utilities.getUuid();
    var candidate = normalizeCandidateSubmission(
      answersFromResponse_(event.response, definition),
      {
        allowedSundays: allowedSundays,
        candidateId: candidateId,
        submittedAt: event.response.getTimestamp().toISOString(),
        holdDays: HOST_INTAKE_CONFIG.holdDays,
      },
    );
    var plan = planSundayHold(values, {
      dateHeader: HOST_INTAKE_CONFIG.dateHeader,
      statusHeader: HOST_INTAKE_CONFIG.statusHeader,
      candidateIdHeader: HOST_INTAKE_CONFIG.candidateIdHeader,
      holdExpiresHeader: HOST_INTAKE_CONFIG.holdExpiresHeader,
      availableValues: HOST_INTAKE_CONFIG.availableValues,
      heldValue: HOST_INTAKE_CONFIG.heldValue,
    }, {
      date: candidate.requestedSunday,
      candidateId: candidateId,
      holdExpiresAt: candidate.holdExpiresAt,
    });
    applyHoldPlan_(coordination, plan);
    try {
      workbookSheet_(HOST_INTAKE_CONFIG.candidatesSheetName)
        .appendRow(candidateToRow(candidate));
    } catch (error) {
      rollbackHoldPlan_(coordination, plan);
      throw error;
    }
    appendOperationsLog_(candidateId, 'Available', 'Candidate / Held', 'Host form submission');
    refreshAvailableSundayChoicesUnlocked_();
    return candidateId;
  } finally {
    lock.releaseLock();
  }
}

function confirmCandidate(candidateId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    var candidates = workbookSheet_(HOST_INTAKE_CONFIG.candidatesSheetName);
    var values = candidates.getDataRange().getValues();
    var headers = values[0].map(normalizedText);
    function candidateColumn_(header) {
      var index = headers.indexOf(header);
      if (index < 0) throw new Error('Candidate header not found: ' + header);
      return index;
    }
    var idIndex = candidateColumn_('Candidate ID');
    var reviewIndex = candidateColumn_('Review State');
    var holdIndex = candidateColumn_('Hold State');
    var actionIndex = candidateColumn_('Operator Action');
    var normalizedId = normalizedText(candidateId);
    if (!normalizedId) {
      var actionRows = values.slice(1).filter(function (row) {
        return normalizedText(row[actionIndex]).toLowerCase() === 'confirm';
      });
      if (actionRows.length !== 1) {
        throw new Error('Set Operator Action to Confirm on exactly one candidate row, then run confirmCandidate.');
      }
      normalizedId = required(actionRows[0][idIndex], 'candidate ID');
    }
    var matchingRows = values.slice(1).flatMap(function (row, offset) {
      return normalizedText(row[idIndex]) === normalizedId ? [offset + 2] : [];
    });
    if (matchingRows.length !== 1) {
      throw new Error('Candidate ID must match exactly one candidate row.');
    }
    var candidateRowNumber = matchingRows[0];
    var candidateRow = values[candidateRowNumber - 1];
    if (['Candidate', 'Confirmed'].indexOf(candidateRow[reviewIndex]) < 0 ||
        ['Held', 'Booked'].indexOf(candidateRow[holdIndex]) < 0) {
      throw new Error('Only a held or partially confirmed Candidate can be confirmed.');
    }

    var coordination = getCoordinationSheet_();
    var coordinationValues = coordinationValues_(coordination);
    var coordinationHeaders = coordinationValues[0].map(normalizedText);
    var coordinationCandidateIndex = coordinationHeaders.indexOf(HOST_INTAKE_CONFIG.candidateIdHeader);
    var coordinationStatusIndex = coordinationHeaders.indexOf(HOST_INTAKE_CONFIG.statusHeader);
    var coordinationExpiresIndex = coordinationHeaders.indexOf(HOST_INTAKE_CONFIG.holdExpiresHeader);
    if (coordinationCandidateIndex < 0 || coordinationStatusIndex < 0 || coordinationExpiresIndex < 0) {
      throw new Error('Coordination hold headers were not found.');
    }
    var coordinationRows = coordinationValues.slice(1).flatMap(function (row, offset) {
      return normalizedText(row[coordinationCandidateIndex]) === normalizedId ? [offset + 2] : [];
    });
    if (coordinationRows.length !== 1) {
      throw new Error('Candidate hold must match exactly one coordination row.');
    }
    var coordinationRowNumber = coordinationRows[0];
    var coordinationRow = coordinationValues[coordinationRowNumber - 1];
    var coordinationStatus = normalizedText(coordinationRow[coordinationStatusIndex]);
    if ([HOST_INTAKE_CONFIG.heldValue, HOST_INTAKE_CONFIG.bookedValue]
      .indexOf(coordinationStatus) < 0) {
      throw new Error('Candidate no longer owns a held or booked coordination row.');
    }

    var fullyConfirmed = coordinationStatus === HOST_INTAKE_CONFIG.bookedValue &&
      candidateRow[reviewIndex] === 'Confirmed' && candidateRow[holdIndex] === 'Booked';
    if (coordinationStatus !== HOST_INTAKE_CONFIG.bookedValue) {
      coordination.getRange(coordinationRowNumber, coordinationStatusIndex + 1)
        .setValue(HOST_INTAKE_CONFIG.bookedValue);
    }
    coordination.getRange(coordinationRowNumber, coordinationExpiresIndex + 1).clearContent();
    if (candidateRow[reviewIndex] !== 'Confirmed') {
      candidates.getRange(candidateRowNumber, reviewIndex + 1).setValue('Confirmed');
    }
    if (candidateRow[holdIndex] !== 'Booked') {
      candidates.getRange(candidateRowNumber, holdIndex + 1).setValue('Booked');
    }
    if (!fullyConfirmed || normalizedText(candidateRow[actionIndex]).toLowerCase() === 'confirm') {
      appendOperationsLog_(normalizedId, 'Candidate / Held', 'Confirmed / Booked', 'Operator confirmation');
    }
    candidates.getRange(candidateRowNumber, actionIndex + 1).setValue('Confirmed');
    refreshAvailableSundayChoicesUnlocked_();
    return normalizedId;
  } finally {
    lock.releaseLock();
  }
}

function releaseExpiredHolds() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    var candidates = workbookSheet_(HOST_INTAKE_CONFIG.candidatesSheetName);
    var values = candidates.getDataRange().getValues();
    if (values.length < 2) return 0;
    var headers = values[0].map(normalizedText);
    function indexOf(header) {
      var index = headers.indexOf(header);
      if (index < 0) throw new Error('Candidate header not found: ' + header);
      return index;
    }
    var candidateIndex = indexOf('Candidate ID');
    var reviewIndex = indexOf('Review State');
    var holdIndex = indexOf('Hold State');
    var expiresIndex = indexOf('Hold Expires At');
    var dateIndex = indexOf('Requested Sunday');
    var now = Date.now();
    var released = 0;
    values.slice(1).forEach(function (row, offset) {
      if (row[holdIndex] !== 'Held' || row[reviewIndex] !== 'Candidate') return;
      if (new Date(row[expiresIndex]).getTime() > now) return;
      var candidateId = row[candidateIndex];
      if (!releaseCoordinationHold_(candidateId, row[dateIndex])) return;
      candidates.getRange(offset + 2, holdIndex + 1).setValue('Released');
      appendOperationsLog_(candidateId, 'Candidate / Held', 'Candidate / Released', 'Seven-day hold expired');
      released += 1;
    });
    refreshAvailableSundayChoicesUnlocked_();
    return released;
  } finally {
    lock.releaseLock();
  }
}

function releaseCoordinationHold_(candidateId, requestedSunday) {
  var sheet = getCoordinationSheet_();
  var values = coordinationValues_(sheet);
  var headers = values[0].map(normalizedText);
  var candidateIndex = headers.indexOf(HOST_INTAKE_CONFIG.candidateIdHeader);
  var statusIndex = headers.indexOf(HOST_INTAKE_CONFIG.statusHeader);
  var expiresIndex = headers.indexOf(HOST_INTAKE_CONFIG.holdExpiresHeader);
  var dateIndex = headers.indexOf(HOST_INTAKE_CONFIG.dateHeader);
  if (candidateIndex < 0 || statusIndex < 0 || expiresIndex < 0 || dateIndex < 0) {
    throw new Error('Coordination hold headers were not found.');
  }
  var rows = values.slice(1).flatMap(function (row, index) {
    return normalizedText(row[candidateIndex]) === candidateId ? [index + 2] : [];
  });
  if (rows.length === 0 && requestedSunday) {
    rows = values.slice(1).flatMap(function (row, index) {
      return normalizedDate(row[dateIndex]) ===
        normalizedDate(requestedSunday) ? [index + 2] : [];
    });
  }
  if (rows.length !== 1) throw new Error('Candidate hold must match exactly one coordination row.');
  var row = values[rows[0] - 1];
  var status = normalizedText(row[statusIndex]);
  var owner = normalizedText(row[candidateIndex]);
  if (status === HOST_INTAKE_CONFIG.availableValues[0] && !owner) return true;
  if (status !== HOST_INTAKE_CONFIG.heldValue || (owner && owner !== candidateId)) {
    return false;
  }
  sheet.getRange(rows[0], expiresIndex + 1).clearContent();
  sheet.getRange(rows[0], candidateIndex + 1).clearContent();
  sheet.getRange(rows[0], statusIndex + 1).setValue(HOST_INTAKE_CONFIG.availableValues[0]);
  return true;
}
