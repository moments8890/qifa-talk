# WeChat Join Experience Design

## Goal

Replace the expired Xiaohongshu join path with the supplied WeChat QR code so visitors have one working way to join Qifa Talk.

## Scope

- Remove every Xiaohongshu URL and user-facing Xiaohongshu reference from the homepage and join page.
- Change the homepage participation card to “加入微信群” and link it to `/join/`.
- Store the supplied QR code as a local PNG under `assets/images/` without recompression or visual modification.
- Display the QR code on `/join/` at a responsive, scannable size with a maximum width of approximately 320 pixels.
- Tell visitors to open WeChat and scan the code to join Qifa Talk.
- Change registration wording from Xiaohongshu comments to registration inside the WeChat group.

## User Flow

1. A visitor selects “加入微信群” on the homepage or “如何加入” in navigation.
2. The visitor lands on `/join/`.
3. The page shows the WeChat QR code and concise scanning instructions.
4. The visitor scans the code with WeChat and joins the group.

## Implementation

- Add one image asset: `assets/images/qifa-talk-wechat-qr.png`.
- Update `index.md` so the former Xiaohongshu card becomes an internal link to `/join/`.
- Update `join.md` so its first step contains the QR image and WeChat instructions.
- Keep the existing page structure and visual language; no modal or new JavaScript is needed.

## Validation

- Confirm no `xhslink.com` or “小红书” references remain in site source.
- Confirm the homepage join card navigates to `/join/`.
- Confirm the QR asset returns HTTP 200 in the built/deployed site.
- Inspect desktop and mobile screenshots for sizing, clipping, and scanability.
- Decode the final rendered QR code when tooling permits, ensuring the asset was not corrupted.
