function yamlString(value) {
  return JSON.stringify(String(value));
}

function escapeMarkdown(value) {
  return value.replaceAll('[', '\\[').replaceAll(']', '\\]');
}

export function renderEvent(event) {
  const number = String(event.number).padStart(3, '0');
  const fullTitle = `${number}. ${event.title}`;
  const parent = event.status === 'past' ? '往期活动' : '即将开始';
  const frontMatter = [
    '---',
    'layout: default',
    `title: ${yamlString(fullTitle)}`,
    `parent: ${yamlString(parent)}`,
    'grand_parent: "启发说"',
    `nav_order: ${event.number}`,
    `event_date: ${yamlString(event.date)}`,
    `event_time: ${yamlString(event.dateDisplay)}`,
    `location: ${yamlString(event.location)}`,
    `event_type: ${yamlString(event.type)}`,
    ...(event.host ? [`host: ${yamlString(event.host)}`] : []),
    ...(event.description
      ? [`description: ${yamlString(event.description.slice(0, 240))}`]
      : []),
    'source: "notion"',
    'notion_sync_managed: true',
    '---',
  ];

  const body = [
    `# ${fullTitle}`,
    '',
    `* **时间**：${event.dateDisplay}`,
    ...(event.location ? [`* **地点**：${event.location}`] : []),
    ...(event.type ? [`* **类型**：${event.type}`] : []),
    ...(event.host ? [`* **Host**：${event.host}`] : []),
  ];

  if (event.description) {
    body.push('', '{: .note-title }', '> **话题简介 (Topic Description)**', '>');
    for (const line of event.description.split('\n')) body.push(`> ${line}`);
  }

  if (event.links.length) {
    body.push('', '## 相关资料', '');
    for (const link of event.links) {
      body.push(
        `- [${escapeMarkdown(link.text || '查看链接')}](${link.href})`,
      );
    }
  }

  return `${frontMatter.join('\n')}\n\n${body.join('\n')}\n`;
}
