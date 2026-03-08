---
layout: default
title: 往期活动
permalink: /past/
---

# 📅 往期活动

{% assign past_events = site.pages | where: "parent", "往期活动" | sort: "nav_order" | reverse %}

> 截至目前，我们已举办 **{{ past_events.size }} 场**精彩活动。

---

{% if past_events.size > 0 %}
<div style="display:flex;flex-direction:column;gap:10px;margin-top:1rem;">
{% for event in past_events %}
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
*暂无活动记录。*
{% endif %}
