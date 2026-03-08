---
layout: home
title: 首页
permalink: /
---

<style>
  .card {
    background: #fff;
    border: 1px solid #e0e7ff;
    border-radius: 12px;
    padding: 14px 12px;
  }
  .card-btn .badge {
    position: absolute;
    top: 10px;
    right: 10px;
    background: #4f46e5;
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
  }
  .card-title { font-weight: 700; font-size: 0.85rem; color: #3730a3; margin-bottom: 3px; }
  .card-desc  { font-size: 0.75rem; color: #6b7280; line-height: 1.4; }
  .card-icon  { font-size: 1.5rem; margin-bottom: 6px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin: 1rem 0; }
  .grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin: 1rem 0; }
  .section-label { font-weight: 600; color: #9ca3af; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
  .section-header { display: flex; align-items: center; gap: 10px; margin: 2rem 0 1rem; }
  .section-header-line { flex: 1; height: 1px; background: #e0e7ff; }
  .section-header-text { font-size: 0.8rem; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }
  .event-title-link { color: #3730a3; text-decoration: none !important; transition: color 0.15s; }
  .event-title-link:hover { color: #6366f1; }
  .event-title-arrow { font-size: 0.75em; opacity: 0; transition: opacity 0.15s, transform 0.15s; display: inline-block; transform: translate(-4px, -4px); }
  .event-title-link:hover .event-title-arrow { opacity: 1; transform: translate(0, -4px); }
  /* Latest event card layout */
  .event-card-body { display: flex; flex-direction: column; gap: 16px; }
  .event-card-text { width: 100%; }
  .event-card-img { width: 100%; height: auto; border-radius: 10px; display: block; }
  @media (min-width: 640px) {
    .event-card-body { flex-direction: row; align-items: flex-start; gap: 20px; }
    .event-card-text { flex: 1; min-width: 0; }
    .event-card-img { width: 50%; height: auto; flex-shrink: 0; }
  }
</style>

{% assign next_event = site.pages | where: "parent", "即将开始" | sort: "nav_order" | first %}

{% if next_event %}
<div class="card" style="border-radius:16px;padding:20px 24px;margin-bottom:1.5rem;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="background:#ef4444;color:#fff;font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:999px;">🔥 最新活动</span>
      {% if next_event.event_type %}<span style="background:#eef2ff;color:#4f46e5;font-size:0.7rem;font-weight:600;padding:3px 10px;border-radius:999px;">{{ next_event.event_type }}</span>{% endif %}
    </div>
    <a href="{{ next_event.url | relative_url }}" style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;background:#eef2ff;border-radius:999px;text-decoration:none;color:#4f46e5;font-size:1rem;" onmouseover="this.style.background='#c7d2fe'" onmouseout="this.style.background='#eef2ff'">→</a>
  </div>
  <div class="event-card-body">
    <div class="event-card-text">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:12px;">
        <a href="{{ next_event.url | relative_url }}" class="event-title-link">{{ next_event.title }} <span class="event-title-arrow">↗</span></a>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        {% if next_event.event_date %}
        <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:#6b7280;">
          <span>📅</span><span>{{ next_event.event_date }}</span>
        </div>
        {% endif %}
        {% if next_event.location %}
        <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:#6b7280;">
          <span>📍</span><span>{{ next_event.location }}</span>
        </div>
        {% endif %}
        {% if next_event.host %}
        <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:#6b7280;">
          <span>🎤</span><span>Host：{{ next_event.host }}</span>
        </div>
        {% endif %}
        {% if next_event.description %}
        <div style="margin-top:8px;padding:10px 12px;background:#f5f3ff;border-left:3px solid #a5b4fc;border-radius:0 8px 8px 0;font-size:0.85rem;color:#4b5563;line-height:1.6;">
          💡 {{ next_event.description }}
        </div>
        {% endif %}
      </div>
    </div>
    {% assign img_num = next_event.nav_order | prepend: "00" | slice: -3, 3 %}
    <img src="/assets/images/{{ img_num }}.jpg" alt="{{ next_event.title }}"
         onerror="this.style.display='none'"
         class="event-card-img">
  </div>
</div>
{% else %}
<div class="card" style="margin-bottom:1.5rem;text-align:center;color:#9ca3af;font-style:italic;">暂无即将开始的活动，敬请期待！</div>
{% endif %}

{% assign all_upcoming = site.pages | where: "parent", "即将开始" | sort: "nav_order" %}
{% if all_upcoming.size > 1 %}
<div style="margin-bottom:2rem;">
  <div class="section-label">🙌 即将开始</div>
  <div style="display:flex;flex-direction:column;gap:8px;">
  {% for event in all_upcoming offset:1 %}
  <a href="{{ event.url | relative_url }}" class="card-btn" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;">
    <span class="card-title" style="margin-bottom:0;">{{ event.title }}</span>
    <span style="font-size:0.8rem;color:#9ca3af;white-space:nowrap;margin-left:12px;">{{ event.event_date }}</span>
  </a>
  {% endfor %}
  </div>
  <a href="{{ '/upcoming/' | relative_url }}" class="btn-text" style="margin-top:8px;">查看全部 <span>→</span></a>
</div>
{% endif %}

<div class="section-header"><div class="section-header-line"></div><div class="section-header-text">📣 如何参与</div><div class="section-header-line"></div></div>

<div class="grid-2">
  <div class="card">
    <div class="card-icon">💬</div>
    <div class="card-title">加入微信群</div>
    <div class="card-desc">联系我们获取群二维码</div>
  </div>
  <div class="card">
    <div class="card-icon">📅</div>
    <div class="card-title">周一晚9点报名</div>
    <div class="card-desc">群内发布接龙链接</div>
  </div>
  <div class="card">
    <div class="card-icon">📖</div>
    <div class="card-title">提前做功课</div>
    <div class="card-desc">了解话题，准备你的观点</div>
  </div>
  <a href="{{ '/poll/' | relative_url }}" class="card-btn">
    <span class="badge">投票 →</span>
    <div class="card-icon">🎤</div>
    <div class="card-title">带着观点来！</div>
    <div class="card-desc">给感兴趣的话题投票</div>
  </a>
</div>

<div class="section-header"><div class="section-header-line"></div><div class="section-header-text">🎤 我们的活动类型</div><div class="section-header-line"></div></div>

<div class="grid-2">
  <div class="card">
    <div class="card-icon">🗣️</div>
    <div class="card-title">辩论局</div>
    <div class="card-desc">围绕议题分正反两方辩论</div>
  </div>
  <div class="card">
    <div class="card-icon">💡</div>
    <div class="card-title">科普 / 分享</div>
    <div class="card-desc">成员主讲，随后开放讨论</div>
  </div>
  <div class="card">
    <div class="card-icon">🎬</div>
    <div class="card-title">一起看电影</div>
    <div class="card-desc">选有深度的电影一起聊</div>
  </div>
  <div class="card">
    <div class="card-icon">🌿</div>
    <div class="card-title">户外活动</div>
    <div class="card-desc">边走边聊，交流思想</div>
  </div>
</div>

<div class="section-header"><div class="section-header-line"></div><div class="section-header-text">🔗 快速导航</div><div class="section-header-line"></div></div>

<div class="grid-3">
  <a href="{{ '/upcoming/' | relative_url }}" class="card-btn" style="text-align:center;">
    <div class="card-icon">🙌</div>
    <div class="card-title" style="margin-bottom:2px;">即将开始</div>
    <div class="card-desc">最新活动</div>
  </a>
  <a href="{{ '/past/' | relative_url }}" class="card-btn" style="text-align:center;">
    <div class="card-icon">📅</div>
    <div class="card-title" style="margin-bottom:2px;">往期活动</div>
    <div class="card-desc">历届回顾</div>
  </a>
  <a href="{{ '/about/' | relative_url }}" class="card-btn" style="text-align:center;">
    <div class="card-icon">💡</div>
    <div class="card-title" style="margin-bottom:2px;">关于我们</div>
    <div class="card-desc">未来规划</div>
  </a>
</div>
