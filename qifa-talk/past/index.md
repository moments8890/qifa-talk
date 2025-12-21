---
layout: default
title: 往期活动
parent: 启发说
nav_order: 2
has_children: true
permalink: /qifa-talk/past/
---

# 📅 Past Events (往期活动)

往期活动回顾。

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

{% assign children = site.pages | where: "parent", "Past Events" | sort: "nav_order" %}
{% for child in children %}
## [{{ child.title }}]({{ child.url | relative_url }})
{% endfor %}
