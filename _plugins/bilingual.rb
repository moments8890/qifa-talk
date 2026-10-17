require 'json'

module QifaTalk
  class Translator
    def initialize(site)
      @phrases = site.data.fetch('english').fetch('phrases')
        .merge(site.data.fetch('event_translations'))
      @pattern = Regexp.union(@phrases.keys.sort_by { |key| -key.length })
    end

    def translate(text)
      text.to_s.gsub(@pattern) { |match| @phrases.fetch(match) }
    end
  end

  module LanguageFilters
    def localize(text)
      return text unless @context.registers[:page]['lang'] == 'en'
      Translator.new(@context.registers[:site]).translate(text)
    end

    def locale_url(path)
      site = @context.registers[:site]
      english = @context.registers[:page]['lang'] == 'en'
      value = path.to_s
      if english && value.start_with?('/') && !value.start_with?('/assets/', '/en/')
        value = "/en#{value}"
      end
      "#{site.baseurl}#{value}"
    end
  end

  class BilingualPages < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      translator = Translator.new(site)
      site.layouts.to_a.each do |name, original|
        translated = original.dup
        # Jekyll caches Liquid templates by path, so each language needs its own key.
        translated.define_singleton_method(:path) { "#{original.path}.en" }
        translated.content = translator.translate(original.content)
          .sub('lang="zh-CN"', 'lang="en"')
          .gsub('site.title', 'site.data.english.site_title')
          .gsub('site.description', 'site.data.english.site_description')
        site.layouts["#{name}-en"] = translated
      end

      originals = site.pages.select { |page| site.layouts.key?(page.data['layout']) }
      originals.each do |original|
        original.data['lang'] = 'zh'
        original.data['chinese_url'] = original.url
        original.data['english_url'] = "/en#{original.url}"
        page = Jekyll::PageWithoutAFile.new(site, site.source, "en/#{original.dir}", original.name)
        page.content = translator.translate(original.content)
        page.data = original.data.dup
        %w[title parent grand_parent location event_type event_time host].each do |field|
          page.data[field] = translator.translate(page.data[field]) if page.data[field]
        end
        # Descriptions in the Chinese front matter are truncated for homepage previews.
        # Translate complete source paragraphs before applying the preview limit.
        paragraphs = original.content.lines.grep(/^> /)
          .map { |line| line.sub(/^> /, '').strip }
          .reject { |line| line.start_with?('**') }
        if original.data['description']
          page.data['description'] = translator.translate(paragraphs.join(' '))[0, 600]
        end
        override = File.join(site.source, '_translations', original.url.sub(%r{^/}, '').sub(%r{/$}, ''), 'index.md')
        page.content = File.read(override) if File.file?(override)
        if page.content.match?(/\p{Han}/)
          Jekyll.logger.warn 'English translation needed:', original.url
        end
        page.data['lang'] = 'en'
        page.data['layout'] = "#{original.data['layout']}-en"
        page.data['permalink'] = original.data['english_url']
        page.data.delete('notion_sync_managed')
        site.pages << page
      end
    end
  end
end

Liquid::Template.register_filter(QifaTalk::LanguageFilters)
