class GoogleIdTokenVerifier
  class InvalidToken < StandardError; end

  def self.verify(id_token)
    p "id_token"
    p id_token
    p "client_id"
    p client_id
    Google::Auth::IDTokens.verify_oidc(id_token, aud: client_id, iss: ["https://accounts.google.com", "accounts.google.com"])
  rescue Google::Auth::IDTokens::VerificationError => e
    p e.message
    raise InvalidToken, e.message
  end

  def self.client_id
    ENV.fetch("GOOGLE_CLIENT_ID")&.strip
  end
end
