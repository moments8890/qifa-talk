---
layout: default
title: Past Events
parent: 启发说
nav_order: 2
has_children: true
permalink: /qifa-talk/past/
---

# 📅 Past Events

往期活动回顾。

<ul>
{% assign children = site.pages | where: "parent", "Past Events" | sort: "nav_order" %}
{% for child in children %}
  <li><a href="{{ child.url | relative_url }}">{{ child.title }}</a></li>
{% endfor %}
</ul>
