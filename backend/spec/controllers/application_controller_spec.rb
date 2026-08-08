require "rails_helper"

RSpec.describe ApplicationController, type: :controller do
  controller do
    def index
      authenticate_request!
      render json: { user_id: current_user.id }
    end
  end

  before do
    routes.draw { get "index" => "anonymous#index" }
  end

  let(:user) { User.create!(email: "a@example.com", google_uid: "g-1", name: "Taro") }

  it "returns the current user when given a valid bearer token" do
    token = JsonWebToken.encode(user.id)
    request.headers["Authorization"] = "Bearer #{token}"

    get :index

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["user_id"]).to eq(user.id)
  end

  it "returns 401 as JSON when no token is given" do
    get :index

    expect(response).to have_http_status(:unauthorized)
    expect(JSON.parse(response.body)["error"]["message"]).to be_present
  end

  it "returns 401 when the token is invalid" do
    request.headers["Authorization"] = "Bearer bogus"

    get :index

    expect(response).to have_http_status(:unauthorized)
  end
end
