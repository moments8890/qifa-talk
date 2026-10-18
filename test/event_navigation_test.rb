require 'uri'
require 'cgi'

root = File.expand_path('../_site', __dir__)
checked = 0
%w[upcoming past en/upcoming en/past].each do |list_path|
  list = File.read(File.join(root, list_path, 'index.html'))
  urls = list.scan(/<a href="([^"]+)" class="card-btn"/).flatten
  urls.each_with_index do |url, index|
    filename = URI::DEFAULT_PARSER.unescape(url).delete_prefix('/')
    event = File.read(File.join(root, filename))
    previous = event[/<a href="([^"]+)" rel="prev"/, 1]
    following = event[/<a href="([^"]+)" rel="next"/, 1]
    expected_previous = index.positive? ? urls[index - 1] : nil
    expected_following = urls[index + 1]
    abort "Incorrect previous link on #{url}" unless previous == expected_previous
    abort "Incorrect next link on #{url}" unless following == expected_following
    [previous, following].compact.each do |neighbor|
      destination = File.read(File.join(root, URI::DEFAULT_PARSER.unescape(neighbor).delete_prefix('/')))
      title = CGI.unescapeHTML(destination[/<title>(.*?) \| /, 1])
      abort "Missing neighboring title on #{url}" unless CGI.unescapeHTML(event).include?(title)
    end
    label = list_path.start_with?('en/') ? 'Event Navigation' : '活动导航'
    abort "Wrong navigation language on #{url}" unless event.include?("aria-label=\"#{label}\"")
    checked += 1
  end
end

%w[index.html about/index.html upcoming/index.html en/index.html en/join/index.html].each do |path|
  abort "Unexpected event navigation on #{path}" if File.read(File.join(root, path)).include?('class="event-navigation')
end
puts "PASS: #{checked} event pages match their list order, boundaries, titles, and language"
