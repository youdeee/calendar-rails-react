class Rack::Attack
  throttle("auth/login", limit: 10, period: 1.minute) do |req|
    req.ip if req.path == "/api/auth/login" && req.post?
  end

  throttle("auth/refresh", limit: 30, period: 1.minute) do |req|
    req.ip if req.path == "/api/auth/refresh" && req.post?
  end
end
