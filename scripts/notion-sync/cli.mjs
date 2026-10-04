function requireValue(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function validateDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) throw new Error('--as-of must use YYYY-MM-DD');

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    throw new Error('--as-of must be a real date in YYYY-MM-DD format');
  }
}

export function parseSyncArguments(args) {
  const options = {
    write: false,
    check: false,
    adoptExisting: false,
    asOf: null,
    url: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--write') options.write = true;
    else if (argument === '--check') options.check = true;
    else if (argument === '--adopt-existing') options.adoptExisting = true;
    else if (argument === '--as-of') {
      options.asOf = requireValue(args, index, argument);
      validateDate(options.asOf);
      index += 1;
    } else if (argument === '--url') {
      options.url = requireValue(args, index, argument);
      index += 1;
    } else {
      throw new Error(`unknown option: ${argument}`);
    }
  }

  if (options.write && options.check) {
    throw new Error('--write and --check cannot be combined');
  }
  if (options.adoptExisting && !options.write) {
    throw new Error('--adopt-existing requires --write');
  }
  return options;
}

export function dateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
