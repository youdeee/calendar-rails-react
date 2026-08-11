class AuthController < ApplicationController
  include ActionController::Cookies

  REFRESH_COOKIE_NAME = :refresh_token
  REFRESH_COOKIE_PATH = "/api/auth"

  def login
    begin
      payload = GoogleIdTokenVerifier.verify(params.require(:id_token))
      user = User.find_or_create_from_google!(payload)
    rescue GoogleIdTokenVerifier::InvalidToken, ArgumentError
      return render json: { error: { message: "Invalid Google token" } }, status: :unauthorized
    end

    issue_tokens_for(user)
  end

  def refresh
    record = RefreshToken.authenticate(cookies[REFRESH_COOKIE_NAME])
    raise Unauthorized unless record

    ActiveRecord::Base.transaction do
      raise Unauthorized unless RefreshToken.claim_atomically!(record.id)

      issue_tokens_for(record.user, status: :ok)
    end
  end

  def logout
    if (record = RefreshToken.authenticate(cookies[REFRESH_COOKIE_NAME]))
      record.revoke!
    end
    cookies.delete(REFRESH_COOKIE_NAME, path: REFRESH_COOKIE_PATH)
    head :no_content
  end

  private

  def issue_tokens_for(user, status: :created)
    access_token = JsonWebToken.encode(user.id)
    raw_refresh_token, = RefreshToken.issue!(user)
    set_refresh_cookie(raw_refresh_token)
    render json: { access_token: access_token, user: user_json(user) }, status: status
  end

  def set_refresh_cookie(raw_token)
    cookies[REFRESH_COOKIE_NAME] = {
      value: raw_token,
      httponly: true,
      secure: Rails.env.production?,
      # Frontend (Netlify/Vercel) and API are deployed on different registrable
      # domains, so a cross-site fetch never attaches a Strict/Lax cookie.
      # :none requires Secure, which force_ssl already guarantees in production.
      same_site: Rails.env.production? ? :none : :strict,
      path: REFRESH_COOKIE_PATH,
      expires: RefreshToken::EXPIRY.from_now
    }
  end
end
