---
layout: default
title: Upcoming Events
parent: 启发说
nav_order: 1
has_children: true
permalink: /qifa-talk/upcoming/
---

# 🙌 Upcoming Events

即将到来的精彩活动！

<ul>
{% assign children = site.pages | where: "parent", "Upcoming Events" | sort: "nav_order" %}
{% for child in children %}
  <li><a href="{{ child.url | relative_url }}">{{ child.title }}</a></li>
{% endfor %}
</ul>
