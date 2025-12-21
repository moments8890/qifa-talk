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

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

{% assign children = site.pages | where: "parent", "Upcoming Events" | sort: "nav_order" %}
{% for child in children %}
## [{{ child.title }}]({{ child.url | relative_url }})
{% endfor %}
