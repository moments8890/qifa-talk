require 'json'
require 'uri'

root = File.expand_path('../_site', __dir__)
chinese_pages = Dir["#{root}/**/*.html"].reject { |path| path.start_with?("#{root}/en/") }
public_pages = chinese_pages.select { |path| File.read(path).include?('class="language-switch') }
abort 'Public page language switches are missing' unless public_pages.size >= 8

public_pages.each do |chinese|
  relative = chinese.delete_prefix("#{root}/")
  english = File.join(root, 'en', relative)
  abort "Missing English counterpart: #{relative}" unless File.file?(english)
  html = File.read(english)
  abort "Wrong language: #{relative}" unless html.include?('<html lang="en">')
  without_switch = html.gsub(/<a[^>]+data-language="zh"[^>]*>.*?<\/a>/m, '')
  abort "Untranslated text: #{relative}" if without_switch.match?(/\p{Han}/)
  abort "Wrong title: #{relative}" unless html.match?(/<title>[^<]*Qifa Talk/)
  html.scan(/href="(\/[^"#?]*)/).flatten.each do |target|
    next if target.start_with?('//')
    decoded = URI::DEFAULT_PARSER.unescape(target)
    path = File.join(root, decoded.delete_prefix('/'))
    path = File.join(path, 'index.html') if decoded.end_with?('/')
    abort "Broken link on #{relative}: #{target}" unless File.file?(path)
  end
end

home = File.read(File.join(root, 'en/index.html'))
chinese_home = File.read(File.join(root, 'index.html'))
featured_links = /<a href="([^"]+)" class="event-title-link"/
expected = chinese_home.scan(featured_links).flatten.map { |url| "/en#{url}" }
abort 'English homepage must feature the same events as Chinese' unless home.scan(featured_links).flatten == expected
chinese_cards = File.read(File.join(root, 'upcoming/index.html')).scan(/<a href="([^"]+)" class="card-btn"/).flatten
abort 'Chinese event lists must not contain translated duplicates' if chinese_cards.any? { |url| url.start_with?('/en/') }
abort 'Tool status messages must be translated' unless File.read(File.join(root, 'en/timer/index.html')).include?('Time is up!') && File.read(File.join(root, 'en/handsup/index.html')).include?('Session not found. Check the code.')
puts "PASS: #{public_pages.size} bilingual page pairs, language coverage, internal links, and tool labels"
