index = File.read('index.md')
join = File.read('join.md')
asset = 'assets/images/qifa-talk-wechat-qr.png'

abort 'QR asset missing' unless File.file?(asset)
abort 'homepage must link to /join/' unless index.include?("{{ '/join/' | relative_url }}")
abort 'homepage must mention WeChat group' unless index.include?('加入微信群')
abort 'join page must render QR asset' unless join.include?("{{ '/assets/images/qifa-talk-wechat-qr.png' | relative_url }}")
abort 'join page must include scan instruction' unless join.include?('打开微信扫一扫')
abort 'join page must identify the Qifa Talk assistant' unless join.include?('启发说小助手')
abort 'join page must identify the QR code as a personal WeChat QR code' unless join.include?('个人微信二维码')
abort 'join page must clarify that the QR code is not a group QR code' unless join.include?('并非微信群二维码')
abort 'join page must say no message is required' unless join.include?('无需另外发送消息')
abort 'join page must say activities are generally free' unless join.include?('活动通常免费')
abort 'join page must retain Monday 9 pm registration timing' unless join.include?('周一晚 9 点')
abort 'join page must link to upcoming events' unless join.include?("{{ '/upcoming/' | relative_url }}")
abort 'join page still claims the QR code directly joins the group' if join.include?('扫描二维码加入启发说微信群')
abort 'join page retains a fixed event frequency' if join.include?('每 1–2 周一场')
abort 'join page retains a fixed afternoon time' if join.include?('2–4 pm')
abort 'join page retains fixed venue examples' if join.include?('公共图书馆、公园或成员家中')
abort 'Xiaohongshu URL remains' if [index, join].any? { |content| content.include?('xhslink.com') }
abort 'Xiaohongshu copy remains' if [index, join].any? { |content| content.include?('小红书') }

puts 'PASS: WeChat join experience is complete'
