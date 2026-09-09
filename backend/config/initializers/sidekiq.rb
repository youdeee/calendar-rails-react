require "sidekiq"
require "sidekiq-cron"

redis_url = ENV.fetch("REDIS_URL", "redis://127.0.0.1:6379/0")

Sidekiq.configure_server do |config|
  config.redis = { url: redis_url }
end

Sidekiq.configure_client do |config|
  config.redis = { url: redis_url }
end

Rails.application.config.after_initialize do
  next unless Sidekiq.server?

  Sidekiq::Cron::Job.load_from_hash(
    "dispatch_due_reminders" => {
      "cron" => "* * * * *",
      "class" => "DispatchDueRemindersJob"
    }
  )
end
