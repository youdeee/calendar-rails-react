class JsonWebToken
  ALGORITHM = "HS256"
  ACCESS_TOKEN_EXPIRY = 15.minutes

  class InvalidToken < StandardError; end

  def self.encode(user_id)
    payload = { sub: user_id, exp: ACCESS_TOKEN_EXPIRY.from_now.to_i }
    JWT.encode(payload, secret, ALGORITHM)
  end

  def self.decode(token)
    payload, = JWT.decode(token, secret, true, algorithm: ALGORITHM)
    payload
  rescue JWT::DecodeError => e
    raise InvalidToken, e.message
  end

  def self.secret
    Rails.application.secret_key_base
  end
end
