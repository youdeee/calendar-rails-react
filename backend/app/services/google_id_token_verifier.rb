class GoogleIdTokenVerifier
  class InvalidToken < StandardError; end

  def self.verify(id_token)
    Google::Auth::IDTokens.verify_oidc(id_token, aud: client_id)
  rescue Google::Auth::IDTokens::VerificationError => e
    raise InvalidToken, e.message
  end

  def self.client_id
    ENV.fetch("GOOGLE_CLIENT_ID")
  end
end
