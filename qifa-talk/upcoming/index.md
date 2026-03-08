---
layout: default
title: 即将开始
permalink: /upcoming/
---

# 🙌 即将开始的活动

每周一晚 9 点在微信群内报名。

---

{% assign upcoming_events = site.pages | where: "parent", "即将开始" | sort: "nav_order" %}

{% if upcoming_events.size > 0 %}
<div style="display:flex;flex-direction:column;gap:10px;margin-top:1rem;">
{% for event in upcoming_events %}
<a href="{{ event.url | relative_url }}" class="card-btn" style="padding:16px 20px;">
  <div style="font-weight:700;color:#3730a3;font-size:1rem;margin-bottom:6px;">{{ event.title }}</div>
  <div style="font-size:0.875rem;color:#6b7280;">
    <span>📅 {{ event.event_date }}</span>
    &nbsp;·&nbsp;
    <span>📍 {{ event.location }}</span>
  </div>
</a>
{% endfor %}
</div>
{% else %}
*暂无活动安排，请关注后续更新。*
{% endif %}
