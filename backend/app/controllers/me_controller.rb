class MeController < ApplicationController
  before_action :authenticate_request!

  def show
    render json: user_json(current_user)
  end
end
