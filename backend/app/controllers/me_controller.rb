class MeController < ApplicationController
  before_action :authenticate_request!

  def show
    render json: user_json(current_user)
  end

  def update
    current_user.update!(time_zone: params.require(:time_zone))
    render json: user_json(current_user)
  end
end
