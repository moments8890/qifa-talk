index = File.read('index.md')
join = File.read('join.md')
asset = 'assets/images/qifa-talk-wechat-qr.png'

abort 'QR asset missing' unless File.file?(asset)
abort 'homepage must link to /join/' unless index.include?("{{ '/join/' | relative_url }}")
abort 'homepage must mention WeChat group' unless index.include?('加入微信群')
abort 'join page must render QR asset' unless join.include?("{{ '/assets/images/qifa-talk-wechat-qr.png' | relative_url }}")
abort 'join page must include scan instruction' unless join.include?('打开微信扫一扫')
abort 'Xiaohongshu URL remains' if [index, join].any? { |content| content.include?('xhslink.com') }
abort 'Xiaohongshu copy remains' if [index, join].any? { |content| content.include?('小红书') }

puts 'PASS: WeChat join experience is complete'
