class ApplicationController < ActionController::API
  class Unauthorized < StandardError; end

  rescue_from Unauthorized, with: :render_unauthorized
  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable

  private

  def authenticate_request!
    raise Unauthorized unless current_user
  end

  def current_user
    return nil if bearer_token.blank?

    @current_user ||= User.find(JsonWebToken.decode(bearer_token)["sub"])
  rescue JsonWebToken::InvalidToken, ActiveRecord::RecordNotFound
    nil
  end

  def bearer_token
    request.headers["Authorization"]&.split(" ")&.last
  end

  def user_json(user)
    { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url }
  end

  def render_unauthorized
    render json: { error: { message: "Unauthorized" } }, status: :unauthorized
  end

  def render_not_found
    render json: { error: { message: "Not Found" } }, status: :not_found
  end

  def render_unprocessable(exception)
    render json: { error: { message: exception.record.errors.full_messages.join(", ") } }, status: :unprocessable_entity
  end
end
