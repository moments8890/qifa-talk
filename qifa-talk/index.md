---
layout: default
title: 启发说
nav_order: 2
has_children: true
permalink: /qifa-talk/
---

# 启发说活动系列

这里是所有启发说活动的存档。

## 🔥 最新活动 (Next Event)

{% assign next_event = site.pages | where: "parent", "Upcoming Events" | sort: "nav_order" | first %}

{% if next_event %}
### [{{ next_event.title }}]({{ next_event.url | relative_url }})

{{ next_event.content | markdownify }}
{% else %}
*暂无即将开始的活动。*
{% endif %}

---

## 活动分类

* [**🙌 Upcoming Events (即将开始)**](upcoming/)
  * 查看最近的辩论与讨论活动安排。
* [**📅 Past Events (往期回顾)**](past/)
  * 浏览过去举办的精彩活动记录。
