class AuthController < ApplicationController
  include ActionController::Cookies

  REFRESH_COOKIE_NAME = :refresh_token
  REFRESH_COOKIE_PATH = "/api/auth"

  def login
    payload = GoogleIdTokenVerifier.verify(params.require(:id_token))
    user = User.find_or_create_from_google!(payload)
    issue_tokens_for(user)
  rescue GoogleIdTokenVerifier::InvalidToken, ArgumentError
    render json: { error: { message: "Invalid Google token" } }, status: :unauthorized
  end

  def logout
    if (record = RefreshToken.authenticate(cookies[REFRESH_COOKIE_NAME]))
      record.revoke!
    end
    cookies.delete(REFRESH_COOKIE_NAME, path: REFRESH_COOKIE_PATH)
    head :no_content
  end

  private

  def issue_tokens_for(user)
    access_token = JsonWebToken.encode(user.id)
    raw_refresh_token, = RefreshToken.issue!(user)
    set_refresh_cookie(raw_refresh_token)
    render json: { access_token: access_token, user: user_json(user) }, status: :created
  end

  def set_refresh_cookie(raw_token)
    cookies[REFRESH_COOKIE_NAME] = {
      value: raw_token,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :strict,
      path: REFRESH_COOKIE_PATH,
      expires: RefreshToken::EXPIRY.from_now
    }
  end
end
