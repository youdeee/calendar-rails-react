Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins Rails.env.production? ? ENV.fetch("FRONTEND_ORIGIN") : ENV.fetch("FRONTEND_ORIGIN", "http://localhost:5173")

    resource "/api/auth/*",
      headers: :any,
      methods: %i[post delete options],
      credentials: true

    resource "/api/*",
      headers: :any,
      methods: %i[get post patch delete options]
  end
end
