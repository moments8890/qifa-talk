---
layout: default
title: 即将到来
parent: 启发说
nav_order: 1
has_children: true
permalink: /qifa-talk/upcoming/
---

# 🙌 Upcoming Events

{% assign next_event = site.pages | where: "parent", "Upcoming Events" | sort: "nav_order" | first %}

{% if next_event %}
### [{{ next_event.title }}]({{ next_event.url | relative_url }})

{{ next_event.content | markdownify }}
{% else %}
*暂无即将开始的活动。*
{% endif %}