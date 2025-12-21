---
layout: default
title: 即将开始
parent: 启发说
nav_order: 1
has_children: true
permalink: /upcoming/
---

# 🙌 Upcoming Events (即将开始)

即将到来的精彩活动！

## 🔥 最新活动 (Next Event)

{% assign next_event = site.pages | where: "parent", "Upcoming Events" | sort: "nav_order" | first %}

{% if next_event %}
### [{{ next_event.title }}]({{ next_event.url | relative_url }})

{{ next_event.content | markdownify }}
{% else %}
*暂无即将开始的活动。*
{% endif %}

---

## 更多活动 (More Events)
