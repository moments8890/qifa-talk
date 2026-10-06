require 'date'

homepage = File.read('index.md')
week_include_path = '_includes/event-week.html'

required_fragments = {
  'homepage must assign all upcoming events before selecting a week' => '{% assign all_upcoming = site.pages | where: "parent", "即将开始" | sort: "nav_order" %}',
  'homepage must derive the selected ISO week through the date-normalizing include' => '{% capture selected_week %}{% include event-week.html date=first_upcoming.event_date %}{% endcapture %}',
  'homepage must trim the selected week key' => '{% assign selected_week = selected_week | strip %}',
  'homepage must derive the current ISO week' => '{% assign current_week = site.time | date: "%G-%V" %}',
  'homepage must loop over upcoming events for featured cards' => '{% for event in all_upcoming %}',
  'homepage must derive each event ISO week through the date-normalizing include' => '{% capture event_week %}{% include event-week.html date=event.event_date %}{% endcapture %}',
  'homepage must trim each event week key' => '{% assign event_week = event_week | strip %}',
  'homepage must select every event in the chosen week' => '{% if event_week == selected_week %}',
  'homepage must label current-week selections' => '本周活动',
  'homepage must label later-week selections' => '下期活动',
  'homepage must exclude selected-week events from the compact list' => '{% unless event_week == selected_week %}',
}.freeze

required_fragments.each do |message, fragment|
  abort message unless homepage.include?(fragment)
end

abort 'homepage must not render only one next_event' if homepage.include?('next_event')
abort 'homepage must not parse ambiguous M/D/YYYY dates directly' if homepage.include?('event.event_date | date: "%G-%V"')
abort 'week-normalization include is missing' unless File.file?(week_include_path)

week_include = File.read(week_include_path)
abort 'week include must split M/D/YYYY components' unless week_include.include?('include.date | split: "/"')
abort 'week include must zero-pad the month' unless week_include.include?('date_parts[0] | prepend: "0" | slice: -2, 2')
abort 'week include must zero-pad the day' unless week_include.include?('date_parts[1] | prepend: "0" | slice: -2, 2')
abort 'week include must emit an ISO week key' unless week_include.include?('date_iso | date: "%G-%V"')

def select_week(events, as_of)
  future = events.select { |event| event.fetch(:date) >= as_of }
  first = future.min_by { |event| [event.fetch(:date), event.fetch(:number)] }
  return [] unless first

  week = first.fetch(:date).strftime('%G-%V')
  future
    .select { |event| event.fetch(:date).strftime('%G-%V') == week }
    .sort_by { |event| [event.fetch(:date), event.fetch(:number)] }
end

events = [
  { number: 55, date: Date.new(2026, 10, 11) },
  { number: 56, date: Date.new(2026, 10, 11) },
  { number: 57, date: Date.new(2026, 10, 17) },
]

selected = select_week(events, Date.new(2026, 10, 5))
abort 'October 5–11 week must include both October 11 events' unless selected.map { |event| event[:number] } == [55, 56]

fallback = select_week(events.drop(2), Date.new(2026, 10, 5))
abort 'an empty current week must fall forward to the next nonempty week' unless fallback.map { |event| event[:number] } == [57]

puts 'PASS: homepage selects every event in the earliest nonempty week'
