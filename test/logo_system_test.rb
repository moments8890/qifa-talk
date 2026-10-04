require 'digest'

ASSET = 'assets/images/qifa-talk-logo.png'
EXPECTED_SHA256 = '8c2e5b84df1be93c956b2bdc0a760224d108af7d1abd2eedd311f17e87e54d8e'
LAYOUTS = %w[default home timer handsup].freeze

abort 'Logo asset missing' unless File.file?(ASSET)
abort 'Logo asset does not match supplied emblem' unless Digest::SHA256.file(ASSET).hexdigest == EXPECTED_SHA256

header = File.read('_includes/site-brand-header.html')
footer = File.read('_includes/site-brand-footer.html')
metadata = File.read('_includes/site-brand-meta.html')
layouts = LAYOUTS.to_h { |name| [name, File.read("_layouts/#{name}.html")] }

abort 'Header brand must link to homepage' unless header.include?("href=\"{{ '/' | relative_url }}\"")
abort 'Header brand must render the emblem' unless header.include?("'/assets/images/qifa-talk-logo.png' | relative_url")
abort 'Header emblem needs meaningful alt text' unless header.include?('alt="启发说标志"')
abort 'Header brand must keep live Chinese text' unless header.include?('>启发说</span>')

abort 'Footer brand must render the emblem' unless footer.include?("'/assets/images/qifa-talk-logo.png' | relative_url")
abort 'Footer emblem must be decorative' unless footer.include?('alt=""') && footer.include?('aria-hidden="true"')
abort 'Footer brand must keep live Chinese text' unless footer.include?('西雅图 · 启发说')

abort 'Favicon must use a relative URL' unless metadata.include?('rel="icon"') && metadata.include?('| relative_url')
abort 'Apple touch icon is missing' unless metadata.include?('rel="apple-touch-icon"')
abort 'Open Graph image must use an absolute URL' unless metadata.include?('property="og:image"') && metadata.include?('| absolute_url')
abort 'Open Graph image alt is missing' unless metadata.include?('property="og:image:alt"')
abort 'Twitter summary card is missing' unless metadata.include?('name="twitter:card" content="summary"')
abort 'Twitter image is missing' unless metadata.include?('name="twitter:image"')

layouts.each do |name, source|
  abort "#{name} layout must use shared header brand" unless source.include?('{% include site-brand-header.html %}')
  abort "#{name} layout must use shared brand metadata" unless source.include?('{% include site-brand-meta.html %}')
  abort "#{name} layout retains emoji branding" if source.include?('🌟 启发说') || source.include?('🌟 西雅图 · 启发说')
end

%w[default home].each do |name|
  abort "#{name} layout must use shared footer brand" unless layouts.fetch(name).include?('{% include site-brand-footer.html %}')
end

home = layouts.fetch('home')
abort 'Homepage hero logo is missing' unless home.include?('class="qifa-hero-logo"')
abort 'Homepage hero logo needs meaningful alt text' unless home.include?('alt="启发说标志"')

puts 'PASS: Qifa Talk logo system is complete'
